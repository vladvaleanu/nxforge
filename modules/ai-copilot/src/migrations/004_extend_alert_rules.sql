-- Extend Alert Rules with Advanced Features
-- Phase 5.1: Advanced logic, time windows, escalation

-- Add new columns to ai_alert_rules
ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS condition_logic VARCHAR(10) DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR'));

-- Time window columns (when rule is active)
ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS time_window_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS time_window_start TIME;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS time_window_end TIME;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS time_window_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}'::integer[];

-- Rate limiting columns
ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS rate_limit_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS rate_limit_count INTEGER DEFAULT 5;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS rate_limit_window_seconds INTEGER DEFAULT 300;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS rate_limit_current_count INTEGER DEFAULT 0;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS rate_limit_window_start TIMESTAMP WITH TIME ZONE;

-- Escalation columns (per-rule)
ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS escalation_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS escalation_after_minutes INTEGER DEFAULT 30;

ALTER TABLE ai_alert_rules 
ADD COLUMN IF NOT EXISTS escalation_to_severity VARCHAR(20) DEFAULT 'critical' CHECK (escalation_to_severity IN ('critical', 'warning', 'info'));

-- Comments
COMMENT ON COLUMN ai_alert_rules.condition_logic IS 'AND = all conditions must match, OR = any condition matches';
COMMENT ON COLUMN ai_alert_rules.time_window_days IS 'Days when rule is active: 1=Mon, 2=Tue, ..., 7=Sun';
COMMENT ON COLUMN ai_alert_rules.rate_limit_count IS 'Max number of alerts in the rate limit window';
COMMENT ON COLUMN ai_alert_rules.escalation_after_minutes IS 'Escalate incident if not acknowledged within this time';
