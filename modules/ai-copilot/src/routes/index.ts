/**
 * AI Copilot Routes
 * API endpoints for Forge AI assistant
 * 
 * All routes prefixed with /api/v1/m/ai-copilot/
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ModuleContext, ChatRequest, HealthResponse, AiConfig } from '../types/index.js';
import type { AlertRuleRequest } from '../types/alert.types.js';
import { OllamaService } from '../services/ollama.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { KnowledgeService } from '../services/knowledge.service.js';
import { AlertRuleService } from '../services/alert-rule.service.js';

// In-memory cache for config (will be replaced with DB read)
let cachedConfig: AiConfig | null = null;

/**
 * Get or create default config
 */
async function getConfig(context: ModuleContext): Promise<AiConfig> {
    if (cachedConfig) return cachedConfig;

    const { prisma, logger } = context.services;

    try {
        // Try to get existing config from the ai_config table
        const result = await prisma.$queryRaw<AiConfig[]>`
      SELECT 
        id,
        provider,
        base_url as "baseUrl",
        model,
        strictness,
        context_window as "contextWindow",
        embedding_model as "embeddingModel",
        batch_window_seconds as "batchWindowSeconds",
        persona_name as "personaName",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM ai_config
      LIMIT 1
    `;

        if (result.length > 0) {
            cachedConfig = result[0];
            return cachedConfig;
        }
    } catch (error) {
        // Table might not exist yet, use defaults
        logger.warn({ error }, 'ai_config table not found, using defaults');
    }

    // Return default config
    return {
        id: 'default',
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1',
        strictness: 5,
        contextWindow: 32768,
        embeddingModel: null,
        batchWindowSeconds: 30,
        personaName: 'Forge',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/**
 * Get or create OllamaService instance
 */
let ollamaService: OllamaService | null = null;

async function getOllamaService(context: ModuleContext): Promise<OllamaService> {
    const config = await getConfig(context);

    if (!ollamaService) {
        ollamaService = new OllamaService(
            { baseUrl: config.baseUrl, model: config.model },
            context.services.logger
        );
    } else {
        ollamaService.updateConfig({ baseUrl: config.baseUrl, model: config.model });
    }

    return ollamaService;
}

/**
 * Get or create KnowledgeService instance
 */
let knowledgeService: KnowledgeService | null = null;

async function getKnowledgeService(context: ModuleContext): Promise<KnowledgeService> {
    if (!knowledgeService) {
        const config = await getConfig(context);
        const embeddingService = new EmbeddingService(
            { baseUrl: config.baseUrl },
            context.services.logger
        );
        knowledgeService = new KnowledgeService({
            prisma: context.services.prisma,
            embedding: embeddingService,
            logger: context.services.logger,
            topK: 5,
            minSimilarity: 0.3,
        });
    }
    return knowledgeService;
}

/**
 * Register all AI Copilot routes
 */
export async function registerRoutes(
    fastify: FastifyInstance,
    context: ModuleContext
): Promise<void> {
    const { logger } = context.services;

    /**
     * GET /health - Health check with Ollama status
     */
    fastify.get('/health', async (_request, _reply): Promise<HealthResponse> => {
        const ollama = await getOllamaService(context);
        const config = await getConfig(context);
        const health = await ollama.healthCheck();

        return {
            module: 'ai-copilot',
            status: health.connected ? 'ok' : 'degraded',
            ollama: health.connected,
            model: config.model,
            availableModels: health.models.map((m) => m.name),
        };
    });

    /**
     * GET /models - List available Ollama models
     */
    fastify.get('/models', async (_request, reply) => {
        const ollama = await getOllamaService(context);

        try {
            const models = await ollama.listModels();
            return {
                success: true,
                models: models.map((m) => ({
                    name: m.name,
                    size: m.size,
                    parameterSize: m.details.parameterSize,
                    family: m.details.family,
                })),
            };
        } catch (error) {
            logger.error({ error }, 'Failed to list models');
            reply.status(503);
            return {
                success: false,
                error: 'Unable to connect to Ollama',
                models: [],
            };
        }
    });

    /**
     * GET /settings - Get current AI configuration
     */
    fastify.get('/settings', async (_request, _reply) => {
        const config = await getConfig(context);
        return {
            success: true,
            settings: {
                provider: config.provider,
                baseUrl: config.baseUrl,
                model: config.model,
                strictness: config.strictness,
                contextWindow: config.contextWindow,
                embeddingModel: config.embeddingModel,
                batchWindowSeconds: config.batchWindowSeconds,
                personaName: config.personaName,
            },
        };
    });

    /**
     * PUT /settings - Update AI configuration
     */
    fastify.put('/settings', async (request: FastifyRequest, reply) => {
        const body = request.body as Partial<AiConfig>;
        const { prisma } = context.services;

        try {
            // Build SET clause dynamically
            const updates: string[] = [];
            const values: any[] = [];

            if (body.provider) {
                updates.push('provider = $' + (values.length + 1));
                values.push(body.provider);
            }
            if (body.baseUrl) {
                updates.push('base_url = $' + (values.length + 1));
                values.push(body.baseUrl);
            }
            if (body.model) {
                updates.push('model = $' + (values.length + 1));
                values.push(body.model);
            }
            if (body.strictness !== undefined) {
                updates.push('strictness = $' + (values.length + 1));
                values.push(body.strictness);
            }
            if (body.contextWindow !== undefined) {
                updates.push('context_window = $' + (values.length + 1));
                values.push(body.contextWindow);
            }
            if (body.personaName) {
                updates.push('persona_name = $' + (values.length + 1));
                values.push(body.personaName);
            }

            updates.push('updated_at = NOW()');

            if (updates.length > 1) {
                await prisma.$executeRawUnsafe(
                    `UPDATE ai_config SET ${updates.join(', ')} WHERE id = (SELECT id FROM ai_config LIMIT 1)`,
                    ...values
                );
                // Clear cache to force reload
                cachedConfig = null;
            }

            const config = await getConfig(context);

            // Update Ollama service with new config
            if (ollamaService) {
                ollamaService.updateConfig({ baseUrl: config.baseUrl, model: config.model });
            }

            return {
                success: true,
                settings: {
                    provider: config.provider,
                    baseUrl: config.baseUrl,
                    model: config.model,
                    strictness: config.strictness,
                    contextWindow: config.contextWindow,
                    personaName: config.personaName,
                },
            };
        } catch (error) {
            logger.error({ error }, 'Failed to update settings');
            reply.status(500);
            return {
                success: false,
                error: 'Failed to update settings',
            };
        }
    });

    /**
     * POST /chat - Send message to Forge
     */
    fastify.post('/chat', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as ChatRequest;
        const ollama = await getOllamaService(context);
        const config = await getConfig(context);

        if (!body.message) {
            reply.status(400);
            return { success: false, error: 'Message is required' };
        }

        // Get RAG context from knowledge base
        let ragContext = '';
        try {
            const knowledge = await getKnowledgeService(context);
            const knowledgeContext = await knowledge.getContext(body.message);
            ragContext = knowledgeContext.formattedContext;

            if (knowledgeContext.documents.length > 0) {
                logger.info({
                    query: body.message.substring(0, 50),
                    documentsFound: knowledgeContext.documents.length
                }, 'RAG context retrieved');
            }
        } catch (error) {
            logger.warn({ error }, 'Failed to get RAG context, proceeding without it');
        }

        // Build system prompt based on config + RAG context
        const systemPrompt = buildSystemPrompt(config, ragContext);

        // Build messages array
        const messages = [{ role: 'user' as const, content: body.message }];

        // Handle streaming vs non-streaming
        if (body.stream === true) {
            // Set headers for SSE
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });

            try {
                for await (const chunk of ollama.chatStream(messages, systemPrompt)) {
                    reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                }
                reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                reply.raw.end();
            } catch (error) {
                logger.error({ error }, 'Chat stream error');
                reply.raw.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
                reply.raw.end();
            }
            return;
        }

        // Non-streaming response
        try {
            const response = await ollama.chat(messages, systemPrompt);
            return {
                success: true,
                response: response.message,
                model: response.model,
                done: response.done,
            };
        } catch (error) {
            logger.error({ error }, 'Chat request failed');
            reply.status(503);
            return {
                success: false,
                error: 'Unable to get response from Forge. Is Ollama running?',
            };
        }
    });

    /**
     * GET /knowledge - Get all AI-accessible documents (admin view)
     */
    fastify.get('/knowledge', async (_request, reply) => {
        const { prisma } = context.services;

        try {
            const documents = await prisma.$queryRawUnsafe<{
                id: string;
                title: string;
                excerpt: string | null;
                status: string;
                category_name: string;
                ai_accessible: boolean;
                has_embedding: boolean;
                updated_at: Date;
            }[]>(`
                SELECT
                    d.id,
                    d.title,
                    d.excerpt,
                    d.status,
                    c.name as category_name,
                    d.ai_accessible,
                    (d.embedding IS NOT NULL) as has_embedding,
                    d.updated_at
                FROM documents d
                LEFT JOIN document_categories c ON d.category_id = c.id
                WHERE d.status = 'PUBLISHED'
                ORDER BY d.ai_accessible DESC, d.updated_at DESC
            `);

            return {
                success: true,
                documents: documents.map(d => ({
                    id: d.id,
                    title: d.title,
                    excerpt: d.excerpt,
                    status: d.status,
                    categoryName: d.category_name,
                    aiAccessible: d.ai_accessible,
                    hasEmbedding: d.has_embedding,
                    updatedAt: d.updated_at,
                })),
            };
        } catch (error) {
            logger.error({ error }, 'Failed to fetch knowledge documents');
            reply.status(500);
            return {
                success: false,
                error: 'Failed to fetch knowledge documents',
                documents: [],
            };
        }
    });

    /**
     * GET /knowledge/stats - Get knowledge base statistics
     */
    fastify.get('/knowledge/stats', async (_request, reply) => {
        try {
            const knowledge = await getKnowledgeService(context);
            const stats = await knowledge.getStats();

            return {
                success: true,
                stats: {
                    totalAiAccessible: stats.total,
                    totalEmbedded: stats.embedded,
                    pendingEmbedding: stats.total - stats.embedded,
                },
            };
        } catch (error) {
            logger.error({ error }, 'Failed to fetch knowledge stats');
            reply.status(500);
            return {
                success: false,
                error: 'Failed to fetch knowledge stats',
            };
        }
    });

    /**
     * POST /knowledge/search - Search knowledge base (for testing RAG)
     */
    fastify.post('/knowledge/search', async (request: FastifyRequest, reply) => {
        const { query, limit } = request.body as { query: string; limit?: number };

        if (!query) {
            reply.status(400);
            return { success: false, error: 'Query is required' };
        }

        try {
            const knowledge = await getKnowledgeService(context);
            const results = await knowledge.findRelevant(query, limit || 5);

            return {
                success: true,
                results: results.map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    excerpt: doc.excerpt,
                    categoryName: doc.categoryName,
                    similarity: Math.round(doc.similarity * 100) / 100,
                })),
            };
        } catch (error) {
            logger.error({ error }, 'Knowledge search failed');
            reply.status(500);
            return {
                success: false,
                error: 'Knowledge search failed',
                results: [],
            };
        }
    });

    // ==========================================
    // INCIDENT & ALERT ENDPOINTS (Phase 3)
    // ==========================================

    /**
     * GET /incidents - List all incidents
     */
    fastify.get('/incidents', async (request: FastifyRequest, reply) => {
        const { status, limit } = request.query as { status?: string; limit?: string };
        const { prisma } = context.services;

        try {
            let query = `
                SELECT * FROM ai_incidents
            `;
            const conditions: string[] = [];

            if (status === 'active') {
                conditions.push(`status IN ('active', 'investigating')`);
            } else if (status === 'resolved') {
                conditions.push(`status IN ('resolved', 'dismissed')`);
            }

            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            query += `
                ORDER BY
                    CASE status
                        WHEN 'active' THEN 1
                        WHEN 'investigating' THEN 2
                        ELSE 3
                    END,
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT ${parseInt(limit || '50')}
            `;

            const incidents = await prisma.$queryRawUnsafe<{
                id: string;
                title: string;
                severity: string;
                status: string;
                impact: string | null;
                alert_count: number;
                has_forge_analysis: boolean;
                created_at: Date;
                updated_at: Date;
                resolved_at: Date | null;
            }[]>(query);

            // Calculate duration for each incident
            const now = new Date();

            return {
                success: true,
                incidents: incidents.map(i => {
                    const diffMs = now.getTime() - new Date(i.created_at).getTime();
                    const diffSeconds = Math.floor(diffMs / 1000);
                    const diffMinutes = Math.floor(diffSeconds / 60);
                    const diffHours = Math.floor(diffMinutes / 60);

                    let duration: string;
                    if (diffHours > 0) {
                        duration = `${diffHours}h ${diffMinutes % 60}m`;
                    } else if (diffMinutes > 0) {
                        duration = `${diffMinutes}m ${diffSeconds % 60}s`;
                    } else {
                        duration = `${diffSeconds}s`;
                    }

                    return {
                        id: i.id,
                        title: i.title,
                        severity: i.severity,
                        status: i.status,
                        impact: i.impact || 'Unknown impact',
                        alertCount: i.alert_count,
                        hasForgeAnalysis: i.has_forge_analysis,
                        duration,
                        createdAt: i.created_at,
                        updatedAt: i.updated_at,
                        resolvedAt: i.resolved_at,
                    };
                }),
            };
        } catch (error) {
            logger.error({ error }, 'Failed to fetch incidents');
            reply.status(500);
            return {
                success: false,
                error: 'Failed to fetch incidents',
                incidents: [],
            };
        }
    });

    /**
     * GET /incidents/:id - Get incident details with alerts
     */
    fastify.get('/incidents/:id', async (request: FastifyRequest, reply) => {
        const { id } = request.params as { id: string };
        const { prisma } = context.services;

        try {
            // Get incident
            const incidents = await prisma.$queryRawUnsafe<{
                id: string;
                title: string;
                severity: string;
                status: string;
                impact: string | null;
                alert_count: number;
                has_forge_analysis: boolean;
                created_at: Date;
                updated_at: Date;
                resolved_at: Date | null;
            }[]>(`SELECT * FROM ai_incidents WHERE id = $1::uuid`, id);

            if (incidents.length === 0) {
                reply.status(404);
                return { success: false, error: 'Incident not found' };
            }

            const incident = incidents[0];

            // Get related alerts
            const alerts = await prisma.$queryRawUnsafe<{
                id: string;
                source: string;
                message: string;
                severity: string;
                labels: Record<string, string>;
                created_at: Date;
            }[]>(
                `SELECT id, source, message, severity, labels, created_at
                 FROM ai_alerts WHERE incident_id = $1::uuid
                 ORDER BY created_at DESC`,
                id
            );

            // Calculate duration
            const now = new Date();
            const diffMs = now.getTime() - new Date(incident.created_at).getTime();
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);

            let duration: string;
            if (diffHours > 0) {
                duration = `${diffHours}h ${diffMinutes % 60}m`;
            } else if (diffMinutes > 0) {
                duration = `${diffMinutes}m ${diffSeconds % 60}s`;
            } else {
                duration = `${diffSeconds}s`;
            }

            return {
                success: true,
                incident: {
                    id: incident.id,
                    title: incident.title,
                    severity: incident.severity,
                    status: incident.status,
                    impact: incident.impact || 'Unknown impact',
                    alertCount: incident.alert_count,
                    hasForgeAnalysis: incident.has_forge_analysis,
                    duration,
                    createdAt: incident.created_at,
                    updatedAt: incident.updated_at,
                    resolvedAt: incident.resolved_at,
                    alerts: alerts.map(a => ({
                        id: a.id,
                        source: a.source,
                        message: a.message,
                        severity: a.severity,
                        labels: a.labels,
                        timestamp: a.created_at,
                    })),
                },
            };
        } catch (error) {
            logger.error({ error, id }, 'Failed to fetch incident');
            reply.status(500);
            return { success: false, error: 'Failed to fetch incident' };
        }
    });

    /**
     * PATCH /incidents/:id - Update incident status
     */
    fastify.patch('/incidents/:id', async (request: FastifyRequest, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as { status?: string; hasForgeAnalysis?: boolean };
        const { prisma } = context.services;

        try {
            const updates: string[] = [];
            const values: any[] = [id];
            let paramIndex = 2;

            if (body.status) {
                updates.push(`status = $${paramIndex++}`);
                values.push(body.status);

                // Set resolved_at if resolving/dismissing
                if (body.status === 'resolved' || body.status === 'dismissed') {
                    updates.push('resolved_at = NOW()');
                }
            }

            if (body.hasForgeAnalysis !== undefined) {
                updates.push(`has_forge_analysis = $${paramIndex++}`);
                values.push(body.hasForgeAnalysis);
            }

            if (updates.length === 0) {
                reply.status(400);
                return { success: false, error: 'No updates provided' };
            }

            updates.push('updated_at = NOW()');

            await prisma.$executeRawUnsafe(
                `UPDATE ai_incidents SET ${updates.join(', ')} WHERE id = $1::uuid`,
                ...values
            );

            logger.info({ id, updates: body }, 'Incident updated');

            return { success: true, message: 'Incident updated' };
        } catch (error) {
            logger.error({ error, id }, 'Failed to update incident');
            reply.status(500);
            return { success: false, error: 'Failed to update incident' };
        }
    });

    /**
     * POST /alerts/ingest - Ingest a new alert (for testing or external sources)
     */
    fastify.post('/alerts/ingest', async (request: FastifyRequest, reply) => {
        const body = request.body as {
            source: string;
            message: string;
            severity?: string;
            labels?: Record<string, string>;
        };

        if (!body.source || !body.message) {
            reply.status(400);
            return { success: false, error: 'source and message are required' };
        }

        try {
            // Import alertBatcher from module index
            const { alertBatcher } = await import('../index.js');

            if (!alertBatcher) {
                reply.status(503);
                return { success: false, error: 'AlertBatcherService not initialized' };
            }

            const alert = await alertBatcher.ingestAlert({
                source: body.source,
                message: body.message,
                severity: (body.severity as any) || 'info',
                labels: body.labels || {},
            });

            logger.info({ alertId: alert.id, source: alert.source }, 'Alert ingested via API');

            reply.status(201);
            return {
                success: true,
                alert: {
                    id: alert.id,
                    source: alert.source,
                    message: alert.message,
                    severity: alert.severity,
                    createdAt: alert.createdAt,
                },
            };
        } catch (error) {
            logger.error({ error }, 'Failed to ingest alert');
            reply.status(500);
            return { success: false, error: 'Failed to ingest alert' };
        }
    });

    // ============================================
    // Alert Rules API
    // ============================================

    const alertRuleService = new AlertRuleService(context.services.prisma, context.services.logger);

    /**
     * GET /alert-rules - List all alert rules
     */
    fastify.get('/alert-rules', async (_request, _reply) => {
        const rules = await alertRuleService.getAllRules();
        return { success: true, rules };
    });

    /**
     * GET /alert-rules/:id - Get a specific alert rule
     */
    fastify.get('/alert-rules/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const rule = await alertRuleService.getRuleById(id);

        if (!rule) {
            return reply.status(404).send({ success: false, error: 'Rule not found' });
        }

        return { success: true, rule };
    });

    /**
     * POST /alert-rules - Create a new alert rule
     */
    fastify.post('/alert-rules', async (request, reply) => {
        try {
            const body = request.body as AlertRuleRequest;
            const rule = await alertRuleService.createRule(body);
            return reply.status(201).send({ success: true, rule });
        } catch (error) {
            const err = error as Error;
            return reply.status(400).send({ success: false, error: err.message });
        }
    });

    /**
     * PUT /alert-rules/:id - Update an alert rule
     */
    fastify.put('/alert-rules/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const body = request.body as Partial<AlertRuleRequest>;
            const rule = await alertRuleService.updateRule(id, body);

            if (!rule) {
                return reply.status(404).send({ success: false, error: 'Rule not found' });
            }

            return { success: true, rule };
        } catch (error) {
            const err = error as Error;
            return reply.status(400).send({ success: false, error: err.message });
        }
    });

    /**
     * PATCH /alert-rules/:id/toggle - Toggle rule enabled status
     */
    fastify.patch('/alert-rules/:id/toggle', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { enabled } = request.body as { enabled: boolean };

        const rule = await alertRuleService.toggleRule(id, enabled);

        if (!rule) {
            return reply.status(404).send({ success: false, error: 'Rule not found' });
        }

        return { success: true, rule };
    });

    /**
     * DELETE /alert-rules/:id - Delete an alert rule
     */
    fastify.delete('/alert-rules/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const deleted = await alertRuleService.deleteRule(id);

        if (!deleted) {
            return reply.status(404).send({ success: false, error: 'Rule not found' });
        }

        return { success: true, message: 'Rule deleted' };
    });

    /**
     * GET /alert-rules/sources - Get available event sources for dropdown
     */
    fastify.get('/alert-rules/sources', async (_request, _reply) => {
        // Return list of known sources
        const sources = [
            { id: '*', name: 'All Sources' },
            { id: 'core', name: 'Core System' },
            { id: 'core-jobs', name: 'Core Jobs' },
            { id: 'job-scheduler', name: 'Job Scheduler' },
            { id: 'consumption-monitor', name: 'Consumption Monitor' },
            { id: 'documentation-manager', name: 'Documentation Manager' },
            { id: 'ai-copilot', name: 'AI Copilot' },
        ];
        return { success: true, sources };
    });

    logger.info('[ai-copilot] Routes registered');
}

/**
 * Build system prompt based on configuration
 */
function buildSystemPrompt(config: AiConfig, ragContext?: string): string {
    const strictnessDescriptions: Record<number, string> = {
        1: 'helpful and friendly',
        2: 'helpful and informative',
        3: 'professional and helpful',
        4: 'professional and focused',
        5: 'balanced advisor',
        6: 'strict advisor',
        7: 'disciplined operator',
        8: 'strict protocol follower',
        9: 'military precision',
        10: 'absolutely strict, no deviations',
    };

    const strictnessLevel = strictnessDescriptions[config.strictness] || 'balanced advisor';

    let prompt = `You are ${config.personaName}, an AI infrastructure operator assistant for datacenter operations.

Your personality: ${strictnessLevel}

Your responsibilities:
- Help operators manage datacenter infrastructure (power, cooling, network)
- Follow Standard Operating Procedures (SOPs) strictly
- Provide clear, actionable guidance
- Never recommend actions outside your domain
- Alert operators to potential issues
- Explain the reasoning behind your recommendations

Important rules:
- You operate within the datacenter infrastructure domain only
- You do not have access to customer server configurations
- Always prioritize safety and stability
- When unsure, recommend consulting documentation or escalating`;

    // Add RAG context if available
    if (ragContext && ragContext.trim()) {
        prompt += `

${ragContext}

CRITICAL INSTRUCTIONS FOR ANSWERING:
- When answering questions about procedures or SOPs, you MUST list ALL steps from the documentation
- Do NOT summarize or skip steps - include every single step in numbered order
- Use exact wording from the documentation for button names, menu paths, and technical terms
- If the documentation contains warnings or safety notes, mention them prominently
- Format your response with clear numbered steps for procedures
- Cite the document title/source when referencing documentation`;
    }

    prompt += `

Current context: Datacenter operations assistant ready to help.`;

    return prompt;
}
