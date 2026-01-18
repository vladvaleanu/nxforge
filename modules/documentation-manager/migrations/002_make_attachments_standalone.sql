-- Make document_id nullable to support standalone media uploads
ALTER TABLE document_attachments
  ALTER COLUMN document_id DROP NOT NULL;

-- Add index for finding standalone media (where document_id IS NULL)
CREATE INDEX idx_document_attachments_standalone ON document_attachments(uploaded_by) WHERE document_id IS NULL;
