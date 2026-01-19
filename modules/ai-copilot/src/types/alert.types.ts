/**
 * Alert and Incident Types
 * Backend types for alert batching and incident management
 */

// Severity levels for alerts and incidents
export type AlertSeverity = 'critical' | 'warning' | 'info';

// Status of an incident
export type IncidentStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';

/**
 * Raw alert from monitoring modules
 */
export interface RawAlert {
    id: string;
    source: string;
    message: string;
    severity: AlertSeverity;
    labels: Record<string, string>;
    incidentId?: string | null;
    createdAt: Date;
}

/**
 * Alert ingestion request
 */
export interface AlertIngestRequest {
    source: string;
    message: string;
    severity?: AlertSeverity;
    labels?: Record<string, string>;
}

/**
 * Grouped incident (multiple alerts)
 */
export interface Incident {
    id: string;
    title: string;
    severity: AlertSeverity;
    status: IncidentStatus;
    impact: string | null;
    alertCount: number;
    hasForgeAnalysis: boolean;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
    alerts?: RawAlert[];
}

/**
 * Incident update request
 */
export interface IncidentUpdateRequest {
    status?: IncidentStatus;
    hasForgeAnalysis?: boolean;
}

/**
 * Alert batcher configuration
 */
export interface AlertBatcherConfig {
    batchWindowSeconds: number;
    minAlertsForIncident: number;
}

/**
 * Batched alert group (internal use)
 */
export interface AlertGroup {
    key: string;
    alerts: RawAlert[];
    severity: AlertSeverity;
    source: string;
    sharedLabels: Record<string, string>;
}

// ============================================
// Alert Rules Configuration Types
// ============================================

/**
 * Condition operators for alert rules
 */
export type AlertConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains';

/**
 * Condition logic type
 */
export type ConditionLogic = 'AND' | 'OR';

/**
 * Single condition in an alert rule
 */
export interface AlertCondition {
    field: string;
    operator: AlertConditionOperator;
    value: string | number;
}

/**
 * Time window configuration
 */
export interface TimeWindow {
    enabled: boolean;
    start?: string;      // HH:MM format
    end?: string;        // HH:MM format
    days: number[];      // 1=Mon, 2=Tue, ..., 7=Sun
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
    enabled: boolean;
    count: number;          // Max triggers in window
    windowSeconds: number;  // Time window in seconds
}

/**
 * Escalation configuration
 */
export interface Escalation {
    enabled: boolean;
    afterMinutes: number;
    toSeverity: AlertSeverity;
}

/**
 * Alert rule defined by user
 */
export interface AlertRule {
    id: string;
    name: string;
    description?: string | null;
    enabled: boolean;
    source: string;          // Module name or '*' for all
    eventType: string;       // Event type or '*' for all
    conditions: AlertCondition[];
    conditionLogic: ConditionLogic;
    severity: AlertSeverity;
    messageTemplate?: string | null;
    labels: Record<string, string>;
    cooldownSeconds: number;
    lastTriggeredAt?: Date | null;
    // Time window
    timeWindow: TimeWindow;
    // Rate limiting
    rateLimit: RateLimit;
    // Escalation
    escalation: Escalation;
    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Request to create/update an alert rule
 */
export interface AlertRuleRequest {
    name: string;
    description?: string;
    enabled?: boolean;
    source: string;
    eventType: string;
    conditions: AlertCondition[];
    conditionLogic?: ConditionLogic;
    severity: AlertSeverity;
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
    escalationToSeverity?: AlertSeverity;
}

/**
 * Event payload for rule evaluation
 */
export interface RuleEvaluationEvent {
    source: string;
    type: string;
    payload: Record<string, any>;
    timestamp: Date;
}


