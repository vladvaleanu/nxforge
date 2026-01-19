/**
 * AI Copilot Module - Forge
 * Local infrastructure intelligence operator
 * 
 * Phase 3: Backend with Ollama integration + Alert Batching
 * Phase 5: Alert Rules Configuration + Advanced Logic + Escalation
 */

import { FastifyPluginAsync } from 'fastify';
import { registerRoutes } from './routes/index.js';
import { AlertBatcherService } from './services/alert-batcher.service.js';
import { AlertRuleService } from './services/alert-rule.service.js';
import { EscalationService } from './services/escalation.service.js';
import type { ModuleContext } from './types/index.js';
import type { RuleEvaluationEvent } from './types/alert.types.js';

// Singleton services (exported for route access)
export let alertBatcher: AlertBatcherService | null = null;
let alertRuleService: AlertRuleService | null = null;
let escalationService: EscalationService | null = null;

/**
 * Evaluate an event against alert rules and create alerts for matches
 */
async function evaluateEventAgainstRules(
    event: RuleEvaluationEvent,
    alertRuleService: AlertRuleService,
    alertBatcher: AlertBatcherService,
    logger: any
): Promise<void> {
    try {
        const matchingRules = await alertRuleService.evaluateEvent(event);

        for (const rule of matchingRules) {
            const alertMessage = alertRuleService.buildAlertMessage(rule, event);

            await alertBatcher.ingestAlert({
                source: event.source,
                message: alertMessage,
                severity: rule.severity,
                labels: {
                    ...rule.labels,
                    ruleId: rule.id,
                    ruleName: rule.name,
                },
            });

            logger.info({ ruleId: rule.id, ruleName: rule.name },
                `[ai-copilot] Alert rule triggered: ${rule.name}`);
        }
    } catch (error: any) {
        logger.error({ error: error.message }, '[ai-copilot] Error evaluating alert rules');
    }
}

/**
 * Forge AI Copilot module plugin
 */
const plugin: FastifyPluginAsync = async (app) => {
    app.log.info('[ai-copilot] Forge module initializing...');

    // Get services from app decoration (provided by core)
    const prisma = (app as any).prisma;
    const eventBus = (app as any).eventBus;

    if (!prisma) {
        app.log.error('Prisma instance not found on app decoration');
        throw new Error('Prisma instance not found on app decoration');
    }

    // Create module context
    const context: ModuleContext = {
        module: {
            id: 'ai-copilot',
            name: 'ai-copilot',
            version: '0.6.0',
        },
        services: {
            prisma,
            logger: app.log as any,
        },
    };

    // Initialize AlertBatcherService
    alertBatcher = new AlertBatcherService(prisma, app.log as any, {
        batchWindowSeconds: 30,
        minAlertsForIncident: 1,
    });
    alertBatcher.start();
    app.log.info('[ai-copilot] AlertBatcherService started');

    // Initialize AlertRuleService
    alertRuleService = new AlertRuleService(prisma, app.log as any);
    app.log.info('[ai-copilot] AlertRuleService initialized');

    // Initialize EscalationService
    escalationService = new EscalationService(prisma, app.log as any, {
        checkIntervalSeconds: 60, // Check every minute
    });
    escalationService.start();
    app.log.info('[ai-copilot] EscalationService started');

    // Subscribe to events from other modules (if eventBus available)
    if (eventBus) {
        // Handle direct alert.created events
        eventBus.on('alert.created', async (ctx: any) => {
            const { payload } = ctx.event;
            if (alertBatcher && payload) {
                await alertBatcher.ingestAlert({
                    source: payload.source || 'unknown',
                    message: payload.message || 'Alert received',
                    severity: payload.severity || 'info',
                    labels: payload.labels || {},
                });
            }
        });
        app.log.info('[ai-copilot] Subscribed to alert.created events');

        // Handle metric.collected events - evaluate against alert rules
        eventBus.on('metric.collected', async (ctx: any) => {
            const { payload } = ctx.event;
            if (!alertRuleService || !alertBatcher || !payload) return;

            const event: RuleEvaluationEvent = {
                source: payload.source || 'unknown',
                type: payload.type || 'metric.collected',
                payload: payload,
                timestamp: new Date(),
            };

            await evaluateEventAgainstRules(event, alertRuleService, alertBatcher, app.log);
        });
        app.log.info('[ai-copilot] Subscribed to metric.collected events');

        // Handle job.completed events
        eventBus.on('job.completed', async (ctx: any) => {
            const { payload } = ctx.event;
            if (!alertRuleService || !alertBatcher || !payload) return;

            const event: RuleEvaluationEvent = {
                source: payload.moduleName || payload.jobId || 'core-jobs',
                type: 'job.completed',
                payload: {
                    ...payload,
                    jobId: payload.jobId,
                    moduleName: payload.moduleName,
                    executionTime: payload.executionTime,
                    result: payload.result,
                },
                timestamp: new Date(),
            };

            await evaluateEventAgainstRules(event, alertRuleService, alertBatcher, app.log);
        });
        app.log.info('[ai-copilot] Subscribed to job.completed events');

        // Handle job.failed events
        eventBus.on('job.failed', async (ctx: any) => {
            const { payload } = ctx.event;
            if (!alertRuleService || !alertBatcher || !payload) return;

            const event: RuleEvaluationEvent = {
                source: payload.moduleName || payload.jobId || 'core-jobs',
                type: 'job.failed',
                payload: {
                    ...payload,
                    jobId: payload.jobId,
                    moduleName: payload.moduleName,
                    error: payload.error,
                    errorMessage: payload.errorMessage || payload.error?.message,
                },
                timestamp: new Date(),
            };

            await evaluateEventAgainstRules(event, alertRuleService, alertBatcher, app.log);
        });
        app.log.info('[ai-copilot] Subscribed to job.failed events');

        // Handle module.loaded events (for monitoring module health)
        eventBus.on('module.loaded', async (ctx: any) => {
            const { payload } = ctx.event;
            if (!alertRuleService || !alertBatcher || !payload) return;

            const event: RuleEvaluationEvent = {
                source: 'core',
                type: 'module.loaded',
                payload: payload,
                timestamp: new Date(),
            };

            await evaluateEventAgainstRules(event, alertRuleService, alertBatcher, app.log);
        });
        app.log.info('[ai-copilot] Subscribed to module.loaded events');
    }

    // Register routes (prefixed with /api/v1/m/ai-copilot/ by core)
    await registerRoutes(app, context);

    // Cleanup on shutdown
    app.addHook('onClose', async () => {
        if (alertBatcher) {
            alertBatcher.stop();
            app.log.info('[ai-copilot] AlertBatcherService stopped');
        }
        if (escalationService) {
            escalationService.stop();
            app.log.info('[ai-copilot] EscalationService stopped');
        }
    });

    app.log.info('[ai-copilot] Forge module initialized successfully');
};

export default plugin;
