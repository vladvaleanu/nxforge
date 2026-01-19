/**
 * Escalation Service
 * Handles automatic escalation of incidents based on alert rule configurations
 */

import type { Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import type { AlertSeverity } from '../types/alert.types.js';

interface EscalationConfig {
    checkIntervalSeconds: number;  // How often to check for escalations
}

interface EscalableIncident {
    id: string;
    severity: AlertSeverity;
    status: string;
    created_at: Date;
    rule_id: string | null;
    escalation_enabled: boolean;
    escalation_after_minutes: number;
    escalation_to_severity: AlertSeverity;
}

/**
 * EscalationService - Background service to auto-escalate incidents
 */
export class EscalationService {
    private prisma: PrismaClient;
    private logger: Logger;
    private config: EscalationConfig;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(prisma: PrismaClient, logger: Logger, config?: Partial<EscalationConfig>) {
        this.prisma = prisma;
        this.logger = logger.child({ service: 'escalation' });
        this.config = {
            checkIntervalSeconds: config?.checkIntervalSeconds ?? 60,
        };
    }

    /**
     * Start the escalation background checker
     */
    start(): void {
        if (this.intervalId) {
            this.logger.warn('EscalationService already running');
            return;
        }

        this.logger.info({ interval: this.config.checkIntervalSeconds }, 'Starting EscalationService');

        // Check immediately on start
        this.checkEscalations();

        // Then check periodically
        this.intervalId = setInterval(
            () => this.checkEscalations(),
            this.config.checkIntervalSeconds * 1000
        );
    }

    /**
     * Stop the escalation background checker
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logger.info('EscalationService stopped');
        }
    }

    /**
     * Check for incidents that need escalation
     */
    async checkEscalations(): Promise<void> {
        try {
            // Find active incidents that:
            // 1. Have an associated rule with escalation enabled
            // 2. Were created longer ago than the escalation threshold
            // 3. Haven't been escalated yet (status is still 'active')
            // 4. Current severity is lower than escalation target

            const incidents = await this.prisma.$queryRaw<EscalableIncident[]>`
                SELECT 
                    i.id,
                    i.severity,
                    i.status,
                    i.created_at,
                    a.source as rule_id,
                    r.escalation_enabled,
                    r.escalation_after_minutes,
                    r.escalation_to_severity
                FROM ai_incidents i
                LEFT JOIN ai_alerts a ON a.incident_id = i.id
                LEFT JOIN ai_alert_rules r ON r.id::text = (a.labels->>'ruleId')
                WHERE i.status = 'active'
                AND r.escalation_enabled = TRUE
                AND i.created_at < NOW() - (r.escalation_after_minutes || ' minutes')::interval
                AND (
                    (i.severity = 'info' AND r.escalation_to_severity IN ('warning', 'critical'))
                    OR (i.severity = 'warning' AND r.escalation_to_severity = 'critical')
                )
                GROUP BY i.id, i.severity, i.status, i.created_at, a.source, 
                         r.escalation_enabled, r.escalation_after_minutes, r.escalation_to_severity
            `;

            if (incidents.length === 0) {
                return;
            }

            this.logger.info({ count: incidents.length }, 'Found incidents to escalate');

            for (const incident of incidents) {
                await this.escalateIncident(incident);
            }
        } catch (error: any) {
            this.logger.error({ error: error.message }, 'Error checking escalations');
        }
    }

    /**
     * Escalate a single incident
     */
    private async escalateIncident(incident: EscalableIncident): Promise<void> {
        try {
            const oldSeverity = incident.severity;
            const newSeverity = incident.escalation_to_severity;

            // Update incident severity and status
            await this.prisma.$executeRaw`
                UPDATE ai_incidents SET 
                    severity = ${newSeverity},
                    status = 'investigating',
                    updated_at = NOW()
                WHERE id = ${incident.id}::uuid
            `;

            // Add an escalation note as a new alert
            await this.prisma.$executeRaw`
                INSERT INTO ai_alerts (
                    id, source, message, severity, labels, incident_id, created_at
                ) VALUES (
                    gen_random_uuid(),
                    'escalation-service',
                    ${`Incident automatically escalated from ${oldSeverity} to ${newSeverity} after ${incident.escalation_after_minutes} minutes without acknowledgment`},
                    ${newSeverity},
                    '{"type": "escalation"}'::jsonb,
                    ${incident.id}::uuid,
                    NOW()
                )
            `;

            this.logger.info({
                incidentId: incident.id,
                oldSeverity,
                newSeverity,
                afterMinutes: incident.escalation_after_minutes,
            }, 'Incident escalated');

        } catch (error: any) {
            this.logger.error({
                incidentId: incident.id,
                error: error.message,
            }, 'Failed to escalate incident');
        }
    }

    /**
     * Manually trigger escalation check (for testing)
     */
    async triggerCheck(): Promise<number> {
        const before = await this.getActiveIncidentCount();
        await this.checkEscalations();
        return before;
    }

    /**
     * Get count of active incidents
     */
    private async getActiveIncidentCount(): Promise<number> {
        const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM ai_incidents WHERE status = 'active'
        `;
        return Number(result[0]?.count ?? 0);
    }
}
