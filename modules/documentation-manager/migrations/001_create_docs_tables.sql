-- Documentation Manager Module - Phase 1 (MVP) Schema
-- Categories, Folders, Documents, Tags, Versions, Attachments, Permissions

-- Document categories
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Hierarchical folder structure
CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category_id UUID NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document status enum (drop first to avoid conflicts)
DROP TYPE IF EXISTS document_status CASCADE;
CREATE TYPE document_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Main documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  excerpt TEXT,
  category_id UUID NOT NULL REFERENCES document_categories(id) ON DELETE RESTRICT,
  folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status document_status DEFAULT 'DRAFT',
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Permission levels enum (drop first to avoid conflicts)
DROP TYPE IF EXISTS document_permission_level CASCADE;
CREATE TYPE document_permission_level AS ENUM ('VIEW', 'EDIT', 'ADMIN');

-- Category-level permissions
CREATE TABLE IF NOT EXISTS document_category_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  permission document_permission_level NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, user_id)
);

-- Document-level permissions (override category permissions)
CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  permission document_permission_level NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document-Tag junction
CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(document_id, tag_id)
);

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version)
);

-- File attachments
CREATE TABLE IF NOT EXISTS document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  filepath VARCHAR(1000) NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_slug ON documents(slug);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_author ON documents(author_id);
CREATE INDEX idx_document_folders_category ON document_folders(category_id);
CREATE INDEX idx_document_folders_parent ON document_folders(parent_id);
CREATE INDEX idx_document_tags_document ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);
CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_attachments_document ON document_attachments(document_id);
CREATE INDEX idx_category_permissions_category ON document_category_permissions(category_id);
CREATE INDEX idx_document_permissions_document ON document_permissions(document_id);

-- Full-text search index on documents
CREATE INDEX idx_documents_search ON documents USING GIN(to_tsvector('english', title || ' ' || content));

-- Insert default categories
INSERT INTO document_categories (name, description, icon, "order") VALUES
  ('Procedures', 'Standard operating procedures and processes', 'ClipboardList', 1),
  ('Technical Documentation', 'Technical specifications and architecture documents', 'Code', 2),
  ('Guides', 'How-to guides and tutorials', 'BookOpen', 3),
  ('Policies', 'Company policies and guidelines', 'Shield', 4),
  ('General', 'General documentation and notes', 'FileText', 5)
ON CONFLICT (name) DO NOTHING;
