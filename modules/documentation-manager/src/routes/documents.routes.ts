import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DocumentService } from '../services/document.service';
import { PermissionService } from '../services/permission.service';
import { VersionService } from '../services/version.service';
import { ModuleContext } from '../types';
import { registerAuthHook, getUserId } from '../middleware/auth.middleware';
import { sendSuccess, sendCreated, sendError, sendForbidden, sendNotFound } from '../utils/response.utils';

// Schema definitions
const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string(),
  categoryId: z.string().uuid(),
  folderId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tags: z.array(z.string()).optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tags: z.array(z.string()).optional(),
  changeNote: z.string().optional(),
});

const listDocumentsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
  trashed: z.union([z.boolean(), z.string()]).optional().transform(val => String(val) === 'true'),
});

export async function documentsRoutes(app: FastifyInstance, context: ModuleContext) {
  const service = new DocumentService(context.services.prisma);
  const permissionService = new PermissionService(context.services.prisma);
  const versionService = new VersionService(context.services.prisma);

  // Register authentication hook for all routes
  registerAuthHook(app);

  /**
   * GET /api/v1/docs/documents
   * List documents with filters
   */
  app.get('/', async (request, reply) => {
    try {
      const query = listDocumentsSchema.parse(request.query);

      const documents = await service.listDocuments({
        categoryId: query.categoryId,
        folderId: query.folderId,
        status: query.status,
        search: query.search,
        tags: query.tags,
        authorId: query.authorId,
        trashed: !!query.trashed,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0,
      });

      reply.send({
        success: true,
        data: documents,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * POST /api/v1/docs/documents
   * Create a new document
   */
  app.post('/', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const data = createDocumentSchema.parse(request.body);

      // Check if user has permission to create in this category
      const hasPermission = await permissionService.hasCategoryPermission(
        userId,
        data.categoryId,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to create document in this category', statusCode: 403 },
        });
      }

      const document = await service.createDocument({
        ...data,
        authorId: userId,
      });

      reply.status(201).send({
        success: true,
        data: document,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/docs/documents/:id
   * Get document by ID
   */
  app.get('/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'VIEW'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to view this document', statusCode: 403 },
        });
      }

      const document = await service.getDocument(id);

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Document not found', statusCode: 404 },
        });
      }

      reply.send({
        success: true,
        data: document,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/docs/documents/slug/:slug
   * Get document by slug
   */
  app.get('/slug/:slug', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { slug } = request.params as { slug: string };

      const document = await service.getDocumentBySlug(slug);

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Document not found', statusCode: 404 },
        });
      }

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        document.id,
        'VIEW'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to view this document', statusCode: 403 },
        });
      }

      reply.send({
        success: true,
        data: document,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * PUT /api/v1/docs/documents/:id
   * Update document
   */
  app.put('/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const data = updateDocumentSchema.parse(request.body);

      // Check edit permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to edit this document', statusCode: 403 },
        });
      }

      const document = await service.updateDocument(id, data, userId);

      reply.send({
        success: true,
        data: document,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * DELETE /api/v1/docs/documents/:id
   * Delete document
   */
  app.delete('/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check admin permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'ADMIN'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to delete this document', statusCode: 403 },
        });
      }

      await service.deleteDocument(id);

      reply.send({
        success: true,
        data: { message: 'Document moved to trash' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * POST /api/v1/docs/documents/:id/restore
   * Restore document from trash
   */
  app.post('/:id/restore', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check edit permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to restore this document', statusCode: 403 },
        });
      }

      const document = await service.restoreDocument(id);

      reply.send({
        success: true,
        data: document,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * DELETE /api/v1/docs/documents/:id/permanent
   * Permanently delete document
   */
  app.delete('/:id/permanent', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check admin permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'ADMIN'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to permanently delete this document', statusCode: 403 },
        });
      }

      await service.permanentDeleteDocument(id);

      reply.send({
        success: true,
        data: { message: 'Document permanently deleted' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/docs/documents/:id/versions
   * Get document version history
   */
  app.get('/:id/versions', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'VIEW'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 },
        });
      }

      const versions = await versionService.getVersions(id);

      reply.send({
        success: true,
        data: versions,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/docs/documents/:id/versions/:version
   * Get specific document version
   */
  app.get('/:id/versions/:version', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id, version } = request.params as { id: string; version: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'VIEW'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 },
        });
      }

      const versionData = await versionService.getVersion(id, parseInt(version));

      if (!versionData) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Version not found', statusCode: 404 },
        });
      }

      reply.send({
        success: true,
        data: versionData,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * POST /api/v1/docs/documents/:id/versions/:version/restore
   * Restore document to a previous version
   */
  app.post('/:id/versions/:version/restore', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id, version } = request.params as { id: string; version: string };

      // Check edit permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 },
        });
      }

      await versionService.restoreVersion(id, parseInt(version), userId);

      // Check if document has AI Access enabled and trigger re-embedding
      const doc = await service.getDocument(id);
      if (doc?.ai_accessible) {
        context.services.logger.info({ documentId: id }, 'Restored document has AI Access enabled, regenerating embedding');
        generateDocumentEmbedding(context, id).catch((err) => {
          context.services.logger.error({ err, documentId: id }, 'Failed to regenerate embedding after restore');
        });
      }

      reply.send({
        success: true,
        data: { message: 'Document restored successfully' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * PUT /api/v1/docs/documents/:id/ai-access
   * Toggle AI accessibility for a document (Forge RAG integration)
   */
  app.put('/:id/ai-access', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const { aiAccessible } = request.body as { aiAccessible: boolean };

      // Check admin permission (only admins can toggle AI access)
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'ADMIN'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Admin permission required to modify AI access', statusCode: 403 },
        });
      }

      // Update ai_accessible flag
      // If disabling, also clear the embedding to ensure it's truly removed
      if (!aiAccessible) {
        await context.services.prisma.$executeRawUnsafe(
          `UPDATE documents SET ai_accessible = $1, embedding = NULL, updated_at = NOW() WHERE id = $2::uuid`,
          aiAccessible,
          id
        );
      } else {
        await context.services.prisma.$executeRawUnsafe(
          `UPDATE documents SET ai_accessible = $1, updated_at = NOW() WHERE id = $2::uuid`,
          aiAccessible,
          id
        );
      }

      // If enabling AI access, generate embedding
      if (aiAccessible) {
        // Queue embedding generation (async, don't block response)
        generateDocumentEmbedding(context, id).catch((err) => {
          context.services.logger.error({ err, documentId: id }, 'Failed to generate embedding');
        });
      }

      reply.send({
        success: true,
        data: {
          id,
          aiAccessible,
          message: aiAccessible
            ? 'Document is now accessible to Forge AI'
            : 'Document is no longer accessible to Forge AI'
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/docs/documents/:id/ai-access
   * Get AI accessibility status for a document
   */
  app.get('/:id/ai-access', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        userId,
        id,
        'VIEW'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 },
        });
      }

      const result = await context.services.prisma.$queryRawUnsafe<{ ai_accessible: boolean; has_embedding: boolean }[]>(
        `SELECT ai_accessible, (embedding IS NOT NULL) as has_embedding FROM documents WHERE id = $1::uuid`,
        id
      );

      if (result.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Document not found', statusCode: 404 },
        });
      }

      reply.send({
        success: true,
        data: {
          id,
          aiAccessible: result[0].ai_accessible,
          hasEmbedding: result[0].has_embedding,
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });


}

/**
 * Generate embedding for a document (called async after enabling AI access)
 */
async function generateDocumentEmbedding(context: ModuleContext, documentId: string): Promise<void> {
  const { prisma, logger } = context.services;

  try {
    // Get document content
    const docs = await prisma.$queryRawUnsafe<{ title: string; content: string }[]>(
      `SELECT title, content FROM documents WHERE id = $1::uuid`,
      documentId
    );

    if (docs.length === 0) {
      logger.warn({ documentId }, 'Document not found for embedding');
      return;
    }

    const doc = docs[0];
    const text = `${doc.title}\n\n${doc.content}`;

    // Call Ollama embedding endpoint
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API failed: ${response.status}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response');
    }

    // Store embedding in database
    const vectorString = `[${data.embedding.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE documents SET embedding = $1::vector WHERE id = $2::uuid`,
      vectorString,
      documentId
    );

    logger.info({ documentId }, 'Document embedding generated successfully');
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to generate document embedding');
    throw error;
  }
}

