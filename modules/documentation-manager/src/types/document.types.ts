/**
 * Document Types
 * Centralized type definitions for document-related database operations
 */

// Document status enum (mirrors database enum)
export type DocumentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// Base document fields from database
export interface DocumentRow {
    id: string;
    title: string;
    slug: string;
    content: string;
    content_html: string;
    excerpt: string;
    category_id: string;
    folder_id: string | null;
    author_id: string;
    status: DocumentStatus;
    ai_accessible: boolean;
    ai_private: boolean;
    created_at: Date;
    updated_at: Date;
    published_at: Date | null;
    deleted_at: Date | null;
}

// Document with joined relations for GET responses
export interface DocumentWithRelations extends DocumentRow {
    category: {
        id: string;
        name: string;
        icon: string | null;
    };
    author: {
        id: string;
        username: string;
        email: string;
    };
    tags: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
}

// Document list item (lighter version for listings)
export interface DocumentListRow {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    status: DocumentStatus;
    folder_id: string | null;
    created_at: Date;
    updated_at: Date;
    published_at: Date | null;
    category: {
        id: string;
        name: string;
        icon: string | null;
    };
    author: {
        id: string;
        username: string;
    };
    tags: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
}

// Document version from database
export interface DocumentVersionRow {
    id: string;
    document_id: string;
    version: number;
    title: string;
    content: string;
    change_note: string | null;
    created_by: string;
    created_at: Date;
    author?: {
        id: string;
        username: string;
    };
}

// AI access status
export interface DocumentAiAccessRow {
    ai_accessible: boolean;
    has_embedding: boolean;
}

// Create document input
export interface CreateDocumentInput {
    title: string;
    content: string;
    categoryId: string;
    folderId?: string;
    authorId: string;
    status?: DocumentStatus;
    tags?: string[];
}

// Update document input
export interface UpdateDocumentInput {
    title?: string;
    content?: string;
    categoryId?: string;
    folderId?: string | null;
    status?: DocumentStatus;
    tags?: string[];
    changeNote?: string;
}
