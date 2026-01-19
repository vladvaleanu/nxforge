-- Migration: Add ai_private column to documents
-- This enables three-tier access control for Forge AI:
-- 1. Private (ai_private=true): Hidden from Forge completely
-- 2. Visible (ai_private=false, ai_accessible=false): Forge can see but won't be trained on
-- 3. Trained (ai_private=false, ai_accessible=true): Forge is trained (embedded) on this doc

-- Add the ai_private column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_private BOOLEAN DEFAULT FALSE;

-- Add index for queries filtering by visibility
CREATE INDEX IF NOT EXISTS idx_documents_ai_private ON documents(ai_private) 
  WHERE ai_private = FALSE;

-- Composite index for Forge queries (visible and trained documents)
CREATE INDEX IF NOT EXISTS idx_documents_ai_visibility ON documents(ai_private, ai_accessible)
  WHERE ai_private = FALSE;

-- Add comment explaining the field
COMMENT ON COLUMN documents.ai_private IS 'When TRUE, document is completely hidden from Forge AI';
