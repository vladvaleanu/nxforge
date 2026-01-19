/**
 * Alert Batcher Service
 * Groups related alerts into incidents based on time windows and shared labels
 */

import type { Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import type {
    RawAlert,
    Incident,
    AlertSeverity,
    AlertBatcherConfig,
    AlertGroup,
    AlertIngestRequest,
} from '../types/alert.types.js';

// Severity priority for determining incident severity
const SEVERITY_PRIORITY: Record<AlertSeverity, number> = {
    critical: 3,
    warning: 2,
    info: 1,
};

/**
 * AlertBatcherService - Groups alerts into incidents
 */
export class AlertBatcherService {
    private prisma: PrismaClient;
    private logger: Logger;
    private config: AlertBatcherConfig;
    private alertBuffer: RawAlert[] = [];
    private batchInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        prisma: PrismaClient,
        logger: Logger,
        config: Partial<AlertBatcherConfig> = {}
    ) {
        this.prisma = prisma;
        this.logger = logger.child({ service: 'alert-batcher' });
        this.config = {
            batchWindowSeconds: config.batchWindowSeconds ?? 30,
            minAlertsForIncident: config.minAlertsForIncident ?? 1,
        };
    }

    /**
     * Start the batcher - processes alerts at configured intervals
     */
    start(): void {
        if (this.isRunning) {
            this.logger.warn('AlertBatcherService already running');
            return;
        }

        this.isRunning = true;
        this.batchInterval = setInterval(
            () => this.processBatch(),
            this.config.batchWindowSeconds * 1000
        );

        this.logger.info(
            { batchWindowSeconds: this.config.batchWindowSeconds },
            'AlertBatcherService started'
        );
    }

    /**
     * Stop the batcher
     */
    stop(): void {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
        this.isRunning = false;
        this.logger.info('AlertBatcherService stopped');
    }

    /**
     * Ingest a new alert into the buffer
     */
    async ingestAlert(request: AlertIngestRequest): Promise<RawAlert> {
        const alert: RawAlert = {
            id: this.generateId(),
            source: request.source,
            message: request.message,
            severity: request.severity || 'info',
            labels: request.labels || {},
            incidentId: null,
            createdAt: new Date(),
        };

        // Store alert in database immediately
        try {
            await this.prisma.$executeRaw`
                INSERT INTO ai_alerts (id, source, message, severity, labels, created_at)
                VALUES (
                    ${alert.id}::uuid,
                    ${alert.source},
                    ${alert.message},
                    ${alert.severity},
                    ${JSON.stringify(alert.labels)}::jsonb,
                    ${alert.createdAt}
                )
            `;
        } catch (error) {
            this.logger.error({ error, alert }, 'Failed to store alert in database');
            throw error;
        }

        // Add to buffer for batching
        this.alertBuffer.push(alert);
        this.logger.debug({ alertId: alert.id, source: alert.source }, 'Alert ingested');

        return alert;
    }

    /**
     * Process buffered alerts and create/update incidents
     */
    async processBatch(): Promise<void> {
        if (this.alertBuffer.length === 0) {
            return;
        }

        const alertsToProcess = [...this.alertBuffer];
        this.alertBuffer = [];

        this.logger.info({ alertCount: alertsToProcess.length }, 'Processing alert batch');

        // Group alerts by source + shared labels
        const groups = this.groupAlerts(alertsToProcess);

        for (const group of groups) {
            await this.createOrUpdateIncident(group);
        }
    }

    /**
     * Group alerts by source and shared labels
     */
    private groupAlerts(alerts: RawAlert[]): AlertGroup[] {
        const groupMap = new Map<string, AlertGroup>();

        for (const alert of alerts) {
            // Create grouping key from source + sorted label keys/values
            const labelParts = Object.entries(alert.labels)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}:${v}`);
            const key = `${alert.source}|${labelParts.join('|')}`;

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    key,
                    alerts: [],
                    severity: alert.severity,
                    source: alert.source,
                    sharedLabels: { ...alert.labels },
                });
            }

            const group = groupMap.get(key)!;
            group.alerts.push(alert);

            // Update group severity to highest priority
            if (SEVERITY_PRIORITY[alert.severity] > SEVERITY_PRIORITY[group.severity]) {
                group.severity = alert.severity;
            }
        }

        return Array.from(groupMap.values());
    }

    /**
     * Create a new incident or update existing one from alert group
     */
    private async createOrUpdateIncident(group: AlertGroup): Promise<Incident> {
        // Check for existing active incident with same source and labels
        const existingIncidents = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM ai_incidents
            WHERE status IN ('active', 'investigating')
            AND title LIKE ${`%${group.source}%`}
            ORDER BY created_at DESC
            LIMIT 1
        `;

        if (existingIncidents.length > 0) {
            // Update existing incident
            return await this.addAlertsToIncident(existingIncidents[0].id, group);
        }

        // Create new incident
        return await this.createIncident(group);
    }

    /**
     * Create a new incident from an alert group
     */
    private async createIncident(group: AlertGroup): Promise<Incident> {
        const incidentId = this.generateId();
        const title = this.generateIncidentTitle(group);
        const impact = this.generateImpactDescription(group);

        try {
            await this.prisma.$executeRaw`
                INSERT INTO ai_incidents (id, title, severity, status, impact, alert_count, created_at, updated_at)
                VALUES (
                    ${incidentId}::uuid,
                    ${title},
                    ${group.severity},
                    'active',
                    ${impact},
                    ${group.alerts.length},
                    NOW(),
                    NOW()
                )
            `;

            // Link alerts to incident
            const alertIds = group.alerts.map(a => a.id);
            await this.prisma.$executeRaw`
                UPDATE ai_alerts
                SET incident_id = ${incidentId}::uuid
                WHERE id = ANY(${alertIds}::uuid[])
            `;

            this.logger.info(
                { incidentId, title, alertCount: group.alerts.length },
                'Created new incident'
            );

            return {
                id: incidentId,
                title,
                severity: group.severity,
                status: 'active',
                impact,
                alertCount: group.alerts.length,
                hasForgeAnalysis: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        } catch (error) {
            this.logger.error({ error, group }, 'Failed to create incident');
            throw error;
        }
    }

    /**
     * Add alerts to an existing incident
     */
    private async addAlertsToIncident(incidentId: string, group: AlertGroup): Promise<Incident> {
        try {
            // Link alerts to incident
            const alertIds = group.alerts.map(a => a.id);
            await this.prisma.$executeRaw`
                UPDATE ai_alerts
                SET incident_id = ${incidentId}::uuid
                WHERE id = ANY(${alertIds}::uuid[])
            `;

            // Update incident alert count and severity
            await this.prisma.$executeRaw`
                UPDATE ai_incidents
                SET
                    alert_count = (SELECT COUNT(*) FROM ai_alerts WHERE incident_id = ${incidentId}::uuid),
                    severity = CASE
                        WHEN ${group.severity} = 'critical' THEN 'critical'
                        WHEN severity = 'critical' THEN 'critical'
                        WHEN ${group.severity} = 'warning' THEN 'warning'
                        WHEN severity = 'warning' THEN 'warning'
                        ELSE 'info'
                    END,
                    updated_at = NOW()
                WHERE id = ${incidentId}::uuid
            `;

            this.logger.info(
                { incidentId, newAlerts: group.alerts.length },
                'Added alerts to existing incident'
            );

            // Fetch updated incident
            const incidents = await this.getIncidentById(incidentId);
            return incidents!;
        } catch (error) {
            this.logger.error({ error, incidentId }, 'Failed to add alerts to incident');
            throw error;
        }
    }

    /**
     * Generate a human-readable incident title
     */
    private generateIncidentTitle(group: AlertGroup): string {
        const sourceLabel = group.source.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (group.alerts.length === 1) {
            // Single alert - use its message (truncated)
            return group.alerts[0].message.length > 100
                ? group.alerts[0].message.substring(0, 97) + '...'
                : group.alerts[0].message;
        }

        // Multiple alerts - summarize
        return `${group.alerts.length} ${sourceLabel} Alerts`;
    }

    /**
     * Generate impact description from labels
     */
    private generateImpactDescription(group: AlertGroup): string {
        const parts: string[] = [];

        if (group.sharedLabels.zone) {
            parts.push(`Zone ${group.sharedLabels.zone}`);
        }
        if (group.sharedLabels.rack) {
            parts.push(`Rack ${group.sharedLabels.rack}`);
        }
        if (group.sharedLabels.device) {
            parts.push(group.sharedLabels.device);
        }

        if (parts.length === 0) {
            return `Affects ${group.source}`;
        }

        return `Affects ${parts.join(', ')}`;
    }

    /**
     * Get incident by ID with alerts
     */
    async getIncidentById(id: string): Promise<Incident | null> {
        const incidents = await this.prisma.$queryRaw<{
            id: string;
            title: string;
            severity: AlertSeverity;
            status: string;
            impact: string | null;
            alert_count: number;
            has_forge_analysis: boolean;
            created_at: Date;
            updated_at: Date;
            resolved_at: Date | null;
        }[]>`
            SELECT * FROM ai_incidents WHERE id = ${id}::uuid
        `;

        if (incidents.length === 0) {
            return null;
        }

        const incident = incidents[0];
        const alerts = await this.getAlertsByIncidentId(id);

        return {
            id: incident.id,
            title: incident.title,
            severity: incident.severity,
            status: incident.status as Incident['status'],
            impact: incident.impact,
            alertCount: incident.alert_count,
            hasForgeAnalysis: incident.has_forge_analysis,
            createdAt: incident.created_at,
            updatedAt: incident.updated_at,
            resolvedAt: incident.resolved_at,
            alerts,
        };
    }

    /**
     * Get all active incidents
     */
    async getActiveIncidents(includeAlerts = false): Promise<Incident[]> {
        const incidents = await this.prisma.$queryRaw<{
            id: string;
            title: string;
            severity: AlertSeverity;
            status: string;
            impact: string | null;
            alert_count: number;
            has_forge_analysis: boolean;
            created_at: Date;
            updated_at: Date;
            resolved_at: Date | null;
        }[]>`
            SELECT * FROM ai_incidents
            WHERE status IN ('active', 'investigating')
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 1
                    WHEN 'warning' THEN 2
                    ELSE 3
                END,
                created_at DESC
        `;

        const result: Incident[] = [];
        for (const incident of incidents) {
            result.push({
                id: incident.id,
                title: incident.title,
                severity: incident.severity,
                status: incident.status as Incident['status'],
                impact: incident.impact,
                alertCount: incident.alert_count,
                hasForgeAnalysis: incident.has_forge_analysis,
                createdAt: incident.created_at,
                updatedAt: incident.updated_at,
                resolvedAt: incident.resolved_at,
                alerts: includeAlerts ? await this.getAlertsByIncidentId(incident.id) : undefined,
            });
        }

        return result;
    }

    /**
     * Get all incidents (including resolved)
     */
    async getAllIncidents(limit = 50): Promise<Incident[]> {
        const incidents = await this.prisma.$queryRaw<{
            id: string;
            title: string;
            severity: AlertSeverity;
            status: string;
            impact: string | null;
            alert_count: number;
            has_forge_analysis: boolean;
            created_at: Date;
            updated_at: Date;
            resolved_at: Date | null;
        }[]>`
            SELECT * FROM ai_incidents
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        return incidents.map(incident => ({
            id: incident.id,
            title: incident.title,
            severity: incident.severity,
            status: incident.status as Incident['status'],
            impact: incident.impact,
            alertCount: incident.alert_count,
            hasForgeAnalysis: incident.has_forge_analysis,
            createdAt: incident.created_at,
            updatedAt: incident.updated_at,
            resolvedAt: incident.resolved_at,
        }));
    }

    /**
     * Update incident status
     */
    async updateIncidentStatus(
        id: string,
        status: Incident['status'],
        hasForgeAnalysis?: boolean
    ): Promise<Incident | null> {
        try {
            if (hasForgeAnalysis !== undefined) {
                await this.prisma.$executeRaw`
                    UPDATE ai_incidents
                    SET status = ${status}, has_forge_analysis = ${hasForgeAnalysis}, updated_at = NOW(),
                        resolved_at = CASE WHEN ${status} IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END
                    WHERE id = ${id}::uuid
                `;
            } else {
                await this.prisma.$executeRaw`
                    UPDATE ai_incidents
                    SET status = ${status}, updated_at = NOW(),
                        resolved_at = CASE WHEN ${status} IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END
                    WHERE id = ${id}::uuid
                `;
            }

            return await this.getIncidentById(id);
        } catch (error) {
            this.logger.error({ error, id, status }, 'Failed to update incident status');
            throw error;
        }
    }

    /**
     * Get alerts by incident ID
     */
    private async getAlertsByIncidentId(incidentId: string): Promise<RawAlert[]> {
        const alerts = await this.prisma.$queryRaw<{
            id: string;
            source: string;
            message: string;
            severity: AlertSeverity;
            labels: Record<string, string>;
            incident_id: string | null;
            created_at: Date;
        }[]>`
            SELECT * FROM ai_alerts
            WHERE incident_id = ${incidentId}::uuid
            ORDER BY created_at DESC
        `;

        return alerts.map(alert => ({
            id: alert.id,
            source: alert.source,
            message: alert.message,
            severity: alert.severity,
            labels: alert.labels,
            incidentId: alert.incident_id,
            createdAt: alert.created_at,
        }));
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return crypto.randomUUID();
    }

    /**
     * Calculate duration string from createdAt
     */
    static calculateDuration(createdAt: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);

        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes % 60}m`;
        }
        if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds % 60}s`;
        }
        return `${diffSeconds}s`;
    }
}
