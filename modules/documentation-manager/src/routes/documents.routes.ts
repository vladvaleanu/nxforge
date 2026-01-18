import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DocumentService } from '../services/document.service';
import { PermissionService } from '../services/permission.service';
import { VersionService } from '../services/version.service';
import { ModuleContext } from '../types';

// Schema definitions
const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string(),
  categoryId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
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
});

export async function documentsRoutes(app: FastifyInstance, context: ModuleContext) {
  const service = new DocumentService(context.services.prisma);
  const permissionService = new PermissionService(context.services.prisma);
  const versionService = new VersionService(context.services.prisma);

  // ... rest of the file using documentService instance
  // Add authentication hook for all routes in this plugin
  app.addHook('onRequest', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: { message: 'Unauthorized - Invalid or missing token', statusCode: 401 },
      });
    }
  });

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
      const user = (request as any).user as { userId: string };
      const data = createDocumentSchema.parse(request.body);

      // Check if user has permission to create in this category
      const hasPermission = await permissionService.hasCategoryPermission(
        user.userId,
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
        authorId: user.userId,
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
      const user = (request as any).user as { userId: string };
      const { id } = request.params as { id: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
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
      const user = (request as any).user as { userId: string };
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
        user.userId,
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
      const user = (request as any).user as { userId: string };
      const { id } = request.params as { id: string };
      const data = updateDocumentSchema.parse(request.body);

      // Check edit permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
        id,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to edit this document', statusCode: 403 },
        });
      }

      const document = await service.updateDocument(id, data, user.userId);

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
      const user = (request as any).user as { userId: string };
      const { id } = request.params as { id: string };

      // Check admin permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
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
        data: { message: 'Document deleted successfully' },
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
      const user = (request as any).user as { userId: string };
      const { id } = request.params as { id: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
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
      const user = (request as any).user as { userId: string };
      const { id, version } = request.params as { id: string; version: string };

      // Check read permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
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
      const user = (request as any).user as { userId: string };
      const { id, version } = request.params as { id: string; version: string };

      // Check edit permission
      const hasPermission = await permissionService.hasDocumentPermission(
        user.userId,
        id,
        'EDIT'
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 },
        });
      }

      await versionService.restoreVersion(id, parseInt(version), user.userId);

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
}

