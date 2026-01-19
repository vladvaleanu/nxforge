/**
 * Alert Rule Service
 * Manages alert rules and evaluates events against them
 * Phase 5.1: Extended with OR logic, time windows, rate limiting, escalation
 */

import type { Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import type {
    AlertRule,
    AlertRuleRequest,
    AlertCondition,
    AlertConditionOperator,
    RuleEvaluationEvent,
    ConditionLogic,
} from '../types/alert.types.js';

/**
 * AlertRuleService - CRUD and evaluation of alert rules
 */
export class AlertRuleService {
    private prisma: PrismaClient;
    private logger: Logger;

    constructor(prisma: PrismaClient, logger: Logger) {
        this.prisma = prisma;
        this.logger = logger.child({ service: 'alert-rules' });
    }

    /**
     * Get all alert rules
     */
    async getAllRules(): Promise<AlertRule[]> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM ai_alert_rules ORDER BY created_at DESC
        `;

        return rows.map(this.mapRowToRule);
    }

    /**
     * Get enabled rules only
     */
    async getEnabledRules(): Promise<AlertRule[]> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM ai_alert_rules WHERE enabled = TRUE ORDER BY created_at DESC
        `;

        return rows.map(this.mapRowToRule);
    }

    /**
     * Get rule by ID
     */
    async getRuleById(id: string): Promise<AlertRule | null> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM ai_alert_rules WHERE id = ${id}::uuid
        `;

        if (rows.length === 0) return null;
        return this.mapRowToRule(rows[0]);
    }

    /**
     * Create a new alert rule
     */
    async createRule(request: AlertRuleRequest): Promise<AlertRule> {
        const id = crypto.randomUUID();
        const conditions = JSON.stringify(request.conditions);
        const labels = JSON.stringify(request.labels || {});
        const timeWindowDays = request.timeWindowDays || [1, 2, 3, 4, 5, 6, 7];

        await this.prisma.$executeRaw`
            INSERT INTO ai_alert_rules (
                id, name, description, enabled, source, event_type,
                conditions, condition_logic, severity, message_template, labels, cooldown_seconds,
                time_window_enabled, time_window_start, time_window_end, time_window_days,
                rate_limit_enabled, rate_limit_count, rate_limit_window_seconds,
                escalation_enabled, escalation_after_minutes, escalation_to_severity
            ) VALUES (
                ${id}::uuid,
                ${request.name},
                ${request.description || null},
                ${request.enabled ?? true},
                ${request.source},
                ${request.eventType},
                ${conditions}::jsonb,
                ${request.conditionLogic || 'AND'},
                ${request.severity},
                ${request.messageTemplate || null},
                ${labels}::jsonb,
                ${request.cooldownSeconds ?? 60},
                ${request.timeWindowEnabled ?? false},
                ${request.timeWindowStart || null}::time,
                ${request.timeWindowEnd || null}::time,
                ${timeWindowDays}::integer[],
                ${request.rateLimitEnabled ?? false},
                ${request.rateLimitCount ?? 5},
                ${request.rateLimitWindowSeconds ?? 300},
                ${request.escalationEnabled ?? false},
                ${request.escalationAfterMinutes ?? 30},
                ${request.escalationToSeverity || 'critical'}
            )
        `;

        this.logger.info({ ruleId: id, name: request.name }, 'Created alert rule');
        return (await this.getRuleById(id))!;
    }

    /**
     * Update an existing alert rule
     */
    async updateRule(id: string, request: Partial<AlertRuleRequest>): Promise<AlertRule | null> {
        const existing = await this.getRuleById(id);
        if (!existing) return null;

        const conditions = request.conditions ? JSON.stringify(request.conditions) : null;
        const labels = request.labels ? JSON.stringify(request.labels) : null;
        const timeWindowDays = request.timeWindowDays ? `{${request.timeWindowDays.join(',')}}` : null;

        await this.prisma.$executeRaw`
            UPDATE ai_alert_rules SET
                name = COALESCE(${request.name}, name),
                description = COALESCE(${request.description}, description),
                enabled = COALESCE(${request.enabled}, enabled),
                source = COALESCE(${request.source}, source),
                event_type = COALESCE(${request.eventType}, event_type),
                conditions = COALESCE(${conditions}::jsonb, conditions),
                condition_logic = COALESCE(${request.conditionLogic}, condition_logic),
                severity = COALESCE(${request.severity}, severity),
                message_template = COALESCE(${request.messageTemplate}, message_template),
                labels = COALESCE(${labels}::jsonb, labels),
                cooldown_seconds = COALESCE(${request.cooldownSeconds}, cooldown_seconds),
                time_window_enabled = COALESCE(${request.timeWindowEnabled}, time_window_enabled),
                time_window_start = COALESCE(${request.timeWindowStart}::time, time_window_start),
                time_window_end = COALESCE(${request.timeWindowEnd}::time, time_window_end),
                time_window_days = COALESCE(${timeWindowDays}::integer[], time_window_days),
                rate_limit_enabled = COALESCE(${request.rateLimitEnabled}, rate_limit_enabled),
                rate_limit_count = COALESCE(${request.rateLimitCount}, rate_limit_count),
                rate_limit_window_seconds = COALESCE(${request.rateLimitWindowSeconds}, rate_limit_window_seconds),
                escalation_enabled = COALESCE(${request.escalationEnabled}, escalation_enabled),
                escalation_after_minutes = COALESCE(${request.escalationAfterMinutes}, escalation_after_minutes),
                escalation_to_severity = COALESCE(${request.escalationToSeverity}, escalation_to_severity),
                updated_at = NOW()
            WHERE id = ${id}::uuid
        `;

        this.logger.info({ ruleId: id }, 'Updated alert rule');
        return await this.getRuleById(id);
    }

    /**
     * Delete an alert rule
     */
    async deleteRule(id: string): Promise<boolean> {
        const result = await this.prisma.$executeRaw`
            DELETE FROM ai_alert_rules WHERE id = ${id}::uuid
        `;

        if (result > 0) {
            this.logger.info({ ruleId: id }, 'Deleted alert rule');
            return true;
        }
        return false;
    }

    /**
     * Toggle rule enabled status
     */
    async toggleRule(id: string, enabled: boolean): Promise<AlertRule | null> {
        await this.prisma.$executeRaw`
            UPDATE ai_alert_rules SET enabled = ${enabled}, updated_at = NOW()
            WHERE id = ${id}::uuid
        `;
        return await this.getRuleById(id);
    }

    /**
     * Evaluate an event against all enabled rules
     * Returns list of rules that match
     */
    async evaluateEvent(event: RuleEvaluationEvent): Promise<AlertRule[]> {
        const rules = await this.getEnabledRules();
        const matchingRules: AlertRule[] = [];

        for (const rule of rules) {
            // Check time window first
            if (rule.timeWindow.enabled && !this.isInTimeWindow(rule)) {
                this.logger.debug({ ruleId: rule.id }, 'Rule outside time window, skipping');
                continue;
            }

            // Check rate limit
            if (rule.rateLimit.enabled && !(await this.checkRateLimit(rule))) {
                this.logger.debug({ ruleId: rule.id }, 'Rule rate limited, skipping');
                continue;
            }

            if (this.eventMatchesRule(event, rule)) {
                // Check cooldown
                if (rule.lastTriggeredAt) {
                    const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownSeconds * 1000);
                    if (new Date() < cooldownEnd) {
                        this.logger.debug({ ruleId: rule.id }, 'Rule in cooldown, skipping');
                        continue;
                    }
                }

                matchingRules.push(rule);

                // Update last triggered time and rate limit counter
                await this.prisma.$executeRaw`
                    UPDATE ai_alert_rules SET 
                        last_triggered_at = NOW(),
                        rate_limit_current_count = CASE 
                            WHEN rate_limit_window_start IS NULL OR 
                                 rate_limit_window_start < NOW() - (rate_limit_window_seconds || ' seconds')::interval
                            THEN 1
                            ELSE rate_limit_current_count + 1
                        END,
                        rate_limit_window_start = CASE 
                            WHEN rate_limit_window_start IS NULL OR 
                                 rate_limit_window_start < NOW() - (rate_limit_window_seconds || ' seconds')::interval
                            THEN NOW()
                            ELSE rate_limit_window_start
                        END
                    WHERE id = ${rule.id}::uuid
                `;
            }
        }

        return matchingRules;
    }

    /**
     * Check if current time is within rule's time window
     */
    private isInTimeWindow(rule: AlertRule): boolean {
        const now = new Date();

        // Check day of week (1=Mon, 7=Sun in our system, JS uses 0=Sun, 1=Mon)
        const currentDay = now.getDay() === 0 ? 7 : now.getDay();
        if (!rule.timeWindow.days.includes(currentDay)) {
            return false;
        }

        // Check time range
        if (rule.timeWindow.start && rule.timeWindow.end) {
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM
            const start = rule.timeWindow.start;
            const end = rule.timeWindow.end;

            // Handle cases where end is after midnight
            if (start <= end) {
                return currentTime >= start && currentTime <= end;
            } else {
                // Overnight window (e.g., 22:00 - 06:00)
                return currentTime >= start || currentTime <= end;
            }
        }

        return true;
    }

    /**
     * Check if rule has exceeded rate limit
     */
    private async checkRateLimit(rule: AlertRule): Promise<boolean> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT rate_limit_current_count, rate_limit_window_start
            FROM ai_alert_rules WHERE id = ${rule.id}::uuid
        `;

        if (rows.length === 0) return true;

        const { rate_limit_current_count, rate_limit_window_start } = rows[0];

        if (!rate_limit_window_start) return true;

        const windowStart = new Date(rate_limit_window_start);
        const windowEnd = new Date(windowStart.getTime() + rule.rateLimit.windowSeconds * 1000);

        // If we're past the window, reset is allowed
        if (new Date() > windowEnd) return true;

        // Check if we've exceeded the limit
        return rate_limit_current_count < rule.rateLimit.count;
    }

    /**
     * Check if an event matches a rule
     */
    private eventMatchesRule(event: RuleEvaluationEvent, rule: AlertRule): boolean {
        // Check source filter
        if (rule.source !== '*' && rule.source !== event.source) {
            return false;
        }

        // Check event type filter
        if (rule.eventType !== '*' && rule.eventType !== event.type) {
            return false;
        }

        // No conditions = always match
        if (rule.conditions.length === 0) {
            return true;
        }

        // Evaluate conditions based on logic type
        if (rule.conditionLogic === 'OR') {
            // OR logic: any condition matches
            for (const condition of rule.conditions) {
                if (this.evaluateCondition(event.payload, condition)) {
                    return true;
                }
            }
            return false;
        } else {
            // AND logic (default): all conditions must match
            for (const condition of rule.conditions) {
                if (!this.evaluateCondition(event.payload, condition)) {
                    return false;
                }
            }
            return true;
        }
    }

    /**
     * Evaluate a single condition against event payload
     */
    private evaluateCondition(payload: Record<string, any>, condition: AlertCondition): boolean {
        const value = this.getNestedValue(payload, condition.field);

        if (value === undefined) {
            return false;
        }

        return this.compareValues(value, condition.operator, condition.value);
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: Record<string, any>, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Compare values using operator
     */
    private compareValues(actual: any, operator: AlertConditionOperator, expected: string | number): boolean {
        switch (operator) {
            case 'eq':
                return actual == expected;
            case 'ne':
                return actual != expected;
            case 'gt':
                return Number(actual) > Number(expected);
            case 'lt':
                return Number(actual) < Number(expected);
            case 'gte':
                return Number(actual) >= Number(expected);
            case 'lte':
                return Number(actual) <= Number(expected);
            case 'contains':
                return String(actual).toLowerCase().includes(String(expected).toLowerCase());
            case 'not_contains':
                return !String(actual).toLowerCase().includes(String(expected).toLowerCase());
            default:
                return false;
        }
    }

    /**
     * Build alert message from template
     */
    buildAlertMessage(rule: AlertRule, event: RuleEvaluationEvent): string {
        if (!rule.messageTemplate) {
            return `Alert: ${rule.name} triggered by ${event.source}`;
        }

        return rule.messageTemplate.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
            const value = this.getNestedValue(event.payload, path);
            return value !== undefined ? String(value) : `{{${path}}}`;
        });
    }

    /**
     * Map database row to AlertRule type
     */
    private mapRowToRule(row: any): AlertRule {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            enabled: row.enabled,
            source: row.source,
            eventType: row.event_type,
            conditions: row.conditions || [],
            conditionLogic: (row.condition_logic || 'AND') as ConditionLogic,
            severity: row.severity,
            messageTemplate: row.message_template,
            labels: row.labels || {},
            cooldownSeconds: row.cooldown_seconds,
            lastTriggeredAt: row.last_triggered_at,
            timeWindow: {
                enabled: row.time_window_enabled || false,
                start: row.time_window_start?.toString().slice(0, 5),
                end: row.time_window_end?.toString().slice(0, 5),
                days: row.time_window_days || [1, 2, 3, 4, 5, 6, 7],
            },
            rateLimit: {
                enabled: row.rate_limit_enabled || false,
                count: row.rate_limit_count || 5,
                windowSeconds: row.rate_limit_window_seconds || 300,
            },
            escalation: {
                enabled: row.escalation_enabled || false,
                afterMinutes: row.escalation_after_minutes || 30,
                toSeverity: row.escalation_to_severity || 'critical',
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
