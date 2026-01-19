/**
 * Knowledge Service
 * RAG retrieval from AI-accessible documents using pgvector similarity search
 */

import type { Logger } from 'pino';
import type { PrismaClient } from '@prisma/client';
import { EmbeddingService } from './embedding.service.js';

export interface KnowledgeDocument {
    id: string;
    title: string;
    content: string;
    excerpt: string | null;
    categoryName: string;
    similarity: number;
}

export interface KnowledgeContext {
    documents: KnowledgeDocument[];
    formattedContext: string;
}

export interface KnowledgeServiceConfig {
    prisma: PrismaClient;
    embedding: EmbeddingService;
    logger: Logger;
    topK?: number;
    minSimilarity?: number;
}

export class KnowledgeService {
    private prisma: PrismaClient;
    private embedding: EmbeddingService;
    private logger: Logger;
    private topK: number;
    private minSimilarity: number;

    constructor(config: KnowledgeServiceConfig) {
        this.prisma = config.prisma;
        this.embedding = config.embedding;
        this.logger = config.logger;
        this.topK = config.topK || 8;  // Increased from 5 for more context
        this.minSimilarity = config.minSimilarity || 0.25;  // Lowered from 0.3 to include more results
    }

    /**
     * Find documents relevant to a query using vector similarity
     * Only searches trained documents (ai_private=FALSE AND ai_accessible=TRUE)
     */
    async findRelevant(query: string, limit?: number): Promise<KnowledgeDocument[]> {
        const k = limit || this.topK;

        try {
            // Generate embedding for the query
            const queryEmbedding = await this.embedding.embed(query);
            const vectorString = `[${queryEmbedding.join(',')}]`;

            // Vector similarity search using pgvector
            // Only search documents that are:
            // 1. Not private (ai_private = FALSE)
            // 2. Accessible to AI (ai_accessible = TRUE)
            // 3. Published
            // 4. Have an embedding
            const results = await this.prisma.$queryRawUnsafe<KnowledgeDocument[]>(`
        SELECT 
          d.id,
          d.title,
          d.content,
          d.excerpt,
          c.name as "categoryName",
          1 - (d.embedding <=> $1::vector) as similarity
        FROM documents d
        LEFT JOIN document_categories c ON d.category_id = c.id
        WHERE d.ai_private = FALSE
          AND d.ai_accessible = TRUE 
          AND d.status = 'PUBLISHED'
          AND d.embedding IS NOT NULL
        ORDER BY d.embedding <=> $1::vector
        LIMIT $2
      `, vectorString, k);

            // Filter by minimum similarity
            return results.filter(doc => doc.similarity >= this.minSimilarity);
        } catch (error) {
            this.logger.error({ error, query: query.substring(0, 100) }, 'RAG search failed');
            return [];
        }
    }

    /**
     * Get formatted context for LLM prompt augmentation
     */
    async getContext(query: string): Promise<KnowledgeContext> {
        const documents = await this.findRelevant(query);

        if (documents.length === 0) {
            return {
                documents: [],
                formattedContext: '',
            };
        }

        // Format documents for LLM context
        const formattedContext = documents.map((doc, i) => {
            const preview = doc.content;  // Use full content for better context
            return `[Document ${i + 1}: ${doc.title} (${doc.categoryName})]
${preview}${preview.length < doc.content.length ? '...' : ''}`;
        }).join('\n\n---\n\n');

        return {
            documents,
            formattedContext: `
RELEVANT DOCUMENTATION:
The following documents from the knowledge base may help answer this question.
Cite these sources when applicable.

${formattedContext}

---
END OF DOCUMENTATION
`,
        };
    }

    /**
     * Generate and store embedding for a document
     */
    async embedDocument(documentId: string): Promise<boolean> {
        try {
            // Get document content
            const doc = await this.prisma.$queryRawUnsafe<{ content: string; title: string }[]>(`
        SELECT content, title FROM documents WHERE id = $1
      `, documentId);

            if (doc.length === 0) {
                this.logger.warn({ documentId }, 'Document not found for embedding');
                return false;
            }

            // Generate embedding from title + content
            const text = `${doc[0].title}\n\n${doc[0].content}`;
            const embedding = await this.embedding.embed(text);
            const vectorString = `[${embedding.join(',')}]`;

            // Store embedding
            await this.prisma.$executeRawUnsafe(`
        UPDATE documents SET embedding = $1::vector WHERE id = $2
      `, vectorString, documentId);

            this.logger.info({ documentId }, 'Document embedding generated');
            return true;
        } catch (error) {
            this.logger.error({ error, documentId }, 'Failed to embed document');
            return false;
        }
    }

    /**
     * Get stats about AI-accessible documents
     * Returns counts for: visible (not private), trained (accessible + embedded)
     */
    async getStats(): Promise<{ total: number; visible: number; trained: number; embedded: number }> {
        const result = await this.prisma.$queryRawUnsafe<{ total: string; visible: string; trained: string; embedded: string }[]>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_private = FALSE) as visible,
        COUNT(*) FILTER (WHERE ai_private = FALSE AND ai_accessible = TRUE) as trained,
        COUNT(*) FILTER (WHERE ai_private = FALSE AND ai_accessible = TRUE AND embedding IS NOT NULL) as embedded
      FROM documents
      WHERE status = 'PUBLISHED'
    `);

        return {
            total: parseInt(result[0]?.total || '0', 10),
            visible: parseInt(result[0]?.visible || '0', 10),
            trained: parseInt(result[0]?.trained || '0', 10),
            embedded: parseInt(result[0]?.embedded || '0', 10),
        };
    }
}
