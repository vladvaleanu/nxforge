-- Alert Rules Table
-- Phase 5: Configurable alert rules from frontend

-- Alert rules table
CREATE TABLE IF NOT EXISTS ai_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Source filtering
  source VARCHAR(100) NOT NULL DEFAULT '*',  -- Module name or '*' for all
  event_type VARCHAR(100) NOT NULL DEFAULT '*',  -- Event type or '*' for all
  
  -- Conditions (stored as JSONB array)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Alert generation settings
  severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  message_template TEXT,  -- Template for alert message, can use {{field}} placeholders
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Additional labels to add to generated alerts
  
  -- Cooldown to prevent alert spam
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_alert_rules_enabled ON ai_alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_alert_rules_source ON ai_alert_rules(source);

-- Comments
COMMENT ON TABLE ai_alert_rules IS 'User-defined alert rules evaluated against incoming events';
COMMENT ON COLUMN ai_alert_rules.conditions IS 'Array of conditions: [{field, operator, value}]';
COMMENT ON COLUMN ai_alert_rules.message_template IS 'Alert message template with {{field}} placeholders';
