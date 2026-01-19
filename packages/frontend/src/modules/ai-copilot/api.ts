/**
 * AI Copilot API Client
 * Frontend API for Forge AI assistant
 */

import { apiClient } from '@/api/client';
import type { ForgeSettings } from './types';

const BASE_URL = '/m/ai-copilot'; // apiClient already has /api/v1 prefix

export interface HealthResponse {
    module: string;
    status: 'ok' | 'degraded' | 'error';
    ollama: boolean;
    model: string | null;
    availableModels: string[];
}

export interface ModelInfo {
    name: string;
    size: number;
    parameterSize: string;
    family: string;
}

export interface ModelsResponse {
    success: boolean;
    models: ModelInfo[];
    error?: string;
}

export interface SettingsResponse {
    success: boolean;
    settings: Partial<ForgeSettings>;
    error?: string;
}

export interface ChatResponse {
    success: boolean;
    response?: string;
    model?: string;
    done?: boolean;
    error?: string;
}

export interface KnowledgeDocument {
    id: string;
    title: string;
    excerpt: string | null;
    status: string;
    categoryName: string;
    aiAccessible: boolean;
    hasEmbedding: boolean;
    updatedAt: string;
}

export interface KnowledgeStats {
    totalAiAccessible: number;
    totalEmbedded: number;
    pendingEmbedding: number;
}

export interface KnowledgeSearchResult {
    id: string;
    title: string;
    excerpt: string | null;
    categoryName: string;
    similarity: number;
}

/**
 * AI Copilot API client
 */
export const forgeApi = {
    /**
     * Get health status including Ollama connection
     */
    getHealth: async (): Promise<HealthResponse> => {
        // apiClient.get returns ApiSuccessResponse which has .data containing our response
        // But backend returns HealthResponse directly, not wrapped
        const response = await apiClient.get<HealthResponse>(`${BASE_URL}/health`);
        // response is ApiSuccessResponse<HealthResponse> with .data being HealthResponse
        // However our module endpoints return data directly, so response IS the data
        return response as unknown as HealthResponse;
    },

    /**
     * List available Ollama models
     */
    getModels: async (): Promise<ModelsResponse> => {
        const response = await apiClient.get<ModelsResponse>(`${BASE_URL}/models`);
        return response as unknown as ModelsResponse;
    },

    /**
     * Get current settings
     */
    getSettings: async (): Promise<SettingsResponse> => {
        const response = await apiClient.get<SettingsResponse>(`${BASE_URL}/settings`);
        return response as unknown as SettingsResponse;
    },

    /**
     * Update settings
     */
    updateSettings: async (settings: Partial<ForgeSettings>): Promise<SettingsResponse> => {
        const response = await apiClient.put<SettingsResponse>(`${BASE_URL}/settings`, settings);
        return response as unknown as SettingsResponse;
    },

    /**
     * Send a chat message (non-streaming)
     */
    chat: async (message: string, context?: string): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>(`${BASE_URL}/chat`, {
            message,
            context,
            stream: false,
        });
        return response as unknown as ChatResponse;
    },

    /**
     * Send a chat message with streaming response
     * Returns an async generator that yields content chunks
     */
    chatStream: async function* (
        message: string,
        context?: string
    ): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Auth token will be handled by the fetch interceptor if configured
            },
            body: JSON.stringify({ message, context, stream: true }),
        });

        if (!response.ok) {
            throw new Error(`Chat failed: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.content) {
                            yield data.content;
                        }
                        if (data.done) {
                            return;
                        }
                        if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    },

    /**
     * Get all documents for knowledge management
     */
    getKnowledgeDocuments: async (): Promise<{ success: boolean; documents: KnowledgeDocument[]; error?: string }> => {
        const response = await apiClient.get<{ success: boolean; documents: KnowledgeDocument[] }>(`${BASE_URL}/knowledge`);
        return response as unknown as { success: boolean; documents: KnowledgeDocument[] };
    },

    /**
     * Get knowledge base statistics
     */
    getKnowledgeStats: async (): Promise<{ success: boolean; stats: KnowledgeStats; error?: string }> => {
        const response = await apiClient.get<{ success: boolean; stats: KnowledgeStats }>(`${BASE_URL}/knowledge/stats`);
        return response as unknown as { success: boolean; stats: KnowledgeStats };
    },

    /**
     * Search knowledge base
     */
    searchKnowledge: async (query: string, limit?: number): Promise<{ success: boolean; results: KnowledgeSearchResult[]; error?: string }> => {
        const response = await apiClient.post<{ success: boolean; results: KnowledgeSearchResult[] }>(`${BASE_URL}/knowledge/search`, { query, limit });
        return response as unknown as { success: boolean; results: KnowledgeSearchResult[] };
    },

    // ==========================================
    // INCIDENT & ALERT ENDPOINTS (Phase 3)
    // ==========================================

    /**
     * Get all incidents
     */
    getIncidents: async (status?: 'active' | 'resolved'): Promise<IncidentsResponse> => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const url = params.toString() ? `${BASE_URL}/incidents?${params}` : `${BASE_URL}/incidents`;
        const response = await apiClient.get<IncidentsResponse>(url);
        return response as unknown as IncidentsResponse;
    },

    /**
     * Get incident by ID with alerts
     */
    getIncident: async (id: string): Promise<IncidentDetailResponse> => {
        const response = await apiClient.get<IncidentDetailResponse>(`${BASE_URL}/incidents/${id}`);
        return response as unknown as IncidentDetailResponse;
    },

    /**
     * Update incident status
     */
    updateIncident: async (id: string, updates: { status?: string; hasForgeAnalysis?: boolean }): Promise<{ success: boolean; message?: string; error?: string }> => {
        const response = await apiClient.getClient().patch<{ success: boolean; message?: string }>(`${BASE_URL}/incidents/${id}`, updates);
        return response.data as unknown as { success: boolean; message?: string };
    },

    /**
     * Ingest a new alert (for testing or external sources)
     */
    ingestAlert: async (alert: AlertIngestRequest): Promise<AlertIngestResponse> => {
        const response = await apiClient.post<AlertIngestResponse>(`${BASE_URL}/alerts/ingest`, alert);
        return response as unknown as AlertIngestResponse;
    },
};

// ==========================================
// INCIDENT TYPES (Phase 3)
// ==========================================

export interface IncidentListItem {
    id: string;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    status: 'active' | 'investigating' | 'resolved' | 'dismissed';
    impact: string;
    alertCount: number;
    hasForgeAnalysis: boolean;
    duration: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
}

export interface IncidentsResponse {
    success: boolean;
    incidents: IncidentListItem[];
    error?: string;
}

export interface RawAlertItem {
    id: string;
    source: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    labels: Record<string, string>;
    timestamp: string;
}

export interface IncidentDetail extends IncidentListItem {
    alerts: RawAlertItem[];
}

export interface IncidentDetailResponse {
    success: boolean;
    incident: IncidentDetail;
    error?: string;
}

export interface AlertIngestRequest {
    source: string;
    message: string;
    severity?: 'critical' | 'warning' | 'info';
    labels?: Record<string, string>;
}

export interface AlertIngestResponse {
    success: boolean;
    alert?: {
        id: string;
        source: string;
        message: string;
        severity: string;
        createdAt: string;
    };
    error?: string;
}

// ==========================================
// ALERT RULES TYPES (Phase 5.1)
// ==========================================

export type AlertConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains';
export type ConditionLogic = 'AND' | 'OR';

export interface AlertCondition {
    field: string;
    operator: AlertConditionOperator;
    value: string | number;
}

export interface TimeWindow {
    enabled: boolean;
    start?: string;
    end?: string;
    days: number[];
}

export interface RateLimit {
    enabled: boolean;
    count: number;
    windowSeconds: number;
}

export interface Escalation {
    enabled: boolean;
    afterMinutes: number;
    toSeverity: 'critical' | 'warning' | 'info';
}

export interface AlertRule {
    id: string;
    name: string;
    description?: string | null;
    enabled: boolean;
    source: string;
    eventType: string;
    conditions: AlertCondition[];
    conditionLogic: ConditionLogic;
    severity: 'critical' | 'warning' | 'info';
    messageTemplate?: string | null;
    labels: Record<string, string>;
    cooldownSeconds: number;
    lastTriggeredAt?: string | null;
    timeWindow: TimeWindow;
    rateLimit: RateLimit;
    escalation: Escalation;
    createdAt: string;
    updatedAt: string;
}

export interface AlertRuleRequest {
    name: string;
    description?: string;
    enabled?: boolean;
    source: string;
    eventType: string;
    conditions: AlertCondition[];
    conditionLogic?: ConditionLogic;
    severity: 'critical' | 'warning' | 'info';
    messageTemplate?: string;
    labels?: Record<string, string>;
    cooldownSeconds?: number;
    // Time window
    timeWindowEnabled?: boolean;
    timeWindowStart?: string;
    timeWindowEnd?: string;
    timeWindowDays?: number[];
    // Rate limiting
    rateLimitEnabled?: boolean;
    rateLimitCount?: number;
    rateLimitWindowSeconds?: number;
    // Escalation
    escalationEnabled?: boolean;
    escalationAfterMinutes?: number;
    escalationToSeverity?: 'critical' | 'warning' | 'info';
}

export interface AlertRulesResponse {
    success: boolean;
    rules: AlertRule[];
    error?: string;
}

export interface AlertRuleResponse {
    success: boolean;
    rule: AlertRule;
    error?: string;
}

export interface EventSource {
    id: string;
    name: string;
}

export interface SourcesResponse {
    success: boolean;
    sources: EventSource[];
}

// Add alert rules methods to forgeApi
export const alertRulesApi = {
    /**
     * Get all alert rules
     */
    getRules: async (): Promise<AlertRulesResponse> => {
        const response = await apiClient.get<AlertRulesResponse>(`${BASE_URL}/alert-rules`);
        return response as unknown as AlertRulesResponse;
    },

    /**
     * Get a specific alert rule
     */
    getRule: async (id: string): Promise<AlertRuleResponse> => {
        const response = await apiClient.get<AlertRuleResponse>(`${BASE_URL}/alert-rules/${id}`);
        return response as unknown as AlertRuleResponse;
    },

    /**
     * Create a new alert rule
     */
    createRule: async (rule: AlertRuleRequest): Promise<AlertRuleResponse> => {
        const response = await apiClient.post<AlertRuleResponse>(`${BASE_URL}/alert-rules`, rule);
        return response as unknown as AlertRuleResponse;
    },

    /**
     * Update an alert rule
     */
    updateRule: async (id: string, rule: Partial<AlertRuleRequest>): Promise<AlertRuleResponse> => {
        const response = await apiClient.getClient().put<AlertRuleResponse>(`${BASE_URL}/alert-rules/${id}`, rule);
        return response.data as unknown as AlertRuleResponse;
    },

    /**
     * Toggle alert rule enabled status
     */
    toggleRule: async (id: string, enabled: boolean): Promise<AlertRuleResponse> => {
        const response = await apiClient.getClient().patch<AlertRuleResponse>(`${BASE_URL}/alert-rules/${id}/toggle`, { enabled });
        return response.data as unknown as AlertRuleResponse;
    },

    /**
     * Delete an alert rule
     */
    deleteRule: async (id: string): Promise<{ success: boolean; error?: string }> => {
        const response = await apiClient.delete<{ success: boolean }>(`${BASE_URL}/alert-rules/${id}`);
        return response as unknown as { success: boolean };
    },

    /**
     * Get available event sources for dropdown
     */
    getSources: async (): Promise<SourcesResponse> => {
        const response = await apiClient.get<SourcesResponse>(`${BASE_URL}/alert-rules/sources`);
        return response as unknown as SourcesResponse;
    },
};

