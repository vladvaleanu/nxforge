-- Incidents and Alerts Tables
-- Phase 3: Alert Batching & Incident Management

-- Incidents table (grouped alerts)
CREATE TABLE IF NOT EXISTS ai_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    impact TEXT,
    alert_count INTEGER NOT NULL DEFAULT 0,
    has_forge_analysis BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Alerts table (raw alerts linked to incidents)
CREATE TABLE IF NOT EXISTS ai_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    labels JSONB DEFAULT '{}',
    incident_id UUID REFERENCES ai_incidents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_incidents_status ON ai_incidents(status);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_severity ON ai_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_ai_incidents_created ON ai_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_incident ON ai_alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_created ON ai_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_source ON ai_alerts(source);

-- Comments for documentation
COMMENT ON TABLE ai_incidents IS 'Grouped incidents from alert batching';
COMMENT ON TABLE ai_alerts IS 'Raw alerts from monitoring modules';
COMMENT ON COLUMN ai_incidents.has_forge_analysis IS 'Whether Forge AI has analyzed this incident';
