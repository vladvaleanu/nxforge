/**
 * Attachments Routes
 * Handle file uploads and downloads for documents
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// import { prisma } from '../lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documentation');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// ... imports
import { ModuleContext } from '../types';

// ...

export async function attachmentsRoutes(app: FastifyInstance, context: ModuleContext) {
  const prisma = context.services.prisma;

  // Add authentication hook for all routes in this plugin
  // ... (rest of the file using local prisma variable)
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

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  /**
   * GET /api/v1/m/documentation-manager/attachments
   * List all attachments across all documents (global media library)
   */
  app.get('/', async (request, reply) => {
    try {
      const { search, limit = '50', offset = '0' } = request.query as {
        search?: string;
        limit?: string;
        offset?: string;
      };

      const whereClause = search
        ? { filename: { contains: search, mode: 'insensitive' as const } }
        : {};

      const attachments = await prisma.documentAttachment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      });

      const total = await prisma.documentAttachment.count({
        where: whereClause,
      });

      reply.send({
        success: true,
        data: attachments,
        meta: { total, limit: parseInt(limit), offset: parseInt(offset) },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * POST /api/v1/m/documentation-manager/attachments
   * Upload a standalone media file (not attached to a document yet)
   */
  app.post('/', async (request, reply) => {
    try {
      const user = (request as any).user as { userId: string };

      // Get uploaded file
      const data = await (request as any).file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { message: 'No file uploaded', statusCode: 400 },
        });
      }

      // Validate file size
      const fileSize = data.file.bytesRead || 0;
      if (fileSize > MAX_FILE_SIZE) {
        return reply.status(400).send({
          success: false,
          error: { message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`, statusCode: 400 },
        });
      }

      // Validate mimetype
      if (!ALLOWED_MIMETYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: { message: 'File type not allowed', statusCode: 400 },
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${sanitizedFilename}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Save file to disk
      await pipeline(data.file, createWriteStream(filepath));

      // Get actual file size
      const stats = await fs.stat(filepath);

      // Create attachment record without documentId (null for standalone media)
      const attachment = await prisma.documentAttachment.create({
        data: {
          documentId: null,
          filename: data.filename,
          filepath: filename, // Store relative path
          mimetype: data.mimetype,
          size: stats.size,
          uploadedBy: user.userId,
        },
      });

      reply.send({
        success: true,
        data: attachment,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * POST /api/v1/m/documentation-manager/attachments/:documentId
   * Upload a file attachment for a document
   */
  app.post('/:documentId', async (request, reply) => {
    try {
      const { documentId } = request.params as { documentId: string };
      const user = (request as any).user as { userId: string };

      // Check if document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Document not found', statusCode: 404 },
        });
      }

      // Get uploaded file
      const data = await (request as any).file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { message: 'No file uploaded', statusCode: 400 },
        });
      }

      // Validate file size
      const fileSize = data.file.bytesRead || 0;
      if (fileSize > MAX_FILE_SIZE) {
        return reply.status(400).send({
          success: false,
          error: { message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`, statusCode: 400 },
        });
      }

      // Validate mimetype
      if (!ALLOWED_MIMETYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: { message: 'File type not allowed', statusCode: 400 },
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${sanitizedFilename}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Save file to disk
      await pipeline(data.file, createWriteStream(filepath));

      // Get actual file size
      const stats = await fs.stat(filepath);

      // Create attachment record
      const attachment = await prisma.documentAttachment.create({
        data: {
          documentId: documentId,
          filename: data.filename,
          filepath: filename, // Store relative path
          mimetype: data.mimetype,
          size: stats.size,
          uploadedBy: user.userId,
        },
      });

      reply.send({
        success: true,
        data: attachment,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * GET /api/v1/m/documentation-manager/attachments/:documentId
   * List attachments for a document
   */
  app.get('/:documentId', async (request, reply) => {
    try {
      const { documentId } = request.params as { documentId: string };

      const attachments = await prisma.documentAttachment.findMany({
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' },
      });

      reply.send({
        success: true,
        data: attachments,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * GET /api/v1/m/documentation-manager/attachments/download/:attachmentId
   * Download a specific attachment
   */
  app.get('/download/:attachmentId', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string };

      const attachment = await prisma.documentAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Attachment not found', statusCode: 404 },
        });
      }

      const filepath = path.join(UPLOAD_DIR, attachment.filepath);

      // Check if file exists
      try {
        await fs.access(filepath);
      } catch {
        return reply.status(404).send({
          success: false,
          error: { message: 'File not found on disk', statusCode: 404 },
        });
      }

      // Send file as stream
      const stream = createReadStream(filepath);
      reply.header('Content-Type', attachment.mimetype);
      reply.header('Content-Disposition', `inline; filename="${attachment.filename}"`);
      return reply.send(stream);
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * DELETE /api/v1/m/documentation-manager/attachments/:attachmentId
   * Delete an attachment
   */
  app.delete('/:attachmentId', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string };
      const user = (request as any).user as { userId: string };

      const attachment = await prisma.documentAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Attachment not found', statusCode: 404 },
        });
      }

      // Only the uploader or admin can delete
      // TODO: Add proper permission check
      if (attachment.uploadedBy !== user.userId) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Insufficient permissions to delete this attachment', statusCode: 403 },
        });
      }

      // Delete file from disk
      const filepath = path.join(UPLOAD_DIR, attachment.filepath);
      try {
        await fs.unlink(filepath);
      } catch (err) {
        // Log error but continue - file might already be deleted
        console.error(`Failed to delete file ${filepath}:`, err);
      }

      // Delete database record
      await prisma.documentAttachment.delete({
        where: { id: attachmentId },
      });

      reply.send({
        success: true,
        data: { message: 'Attachment deleted successfully' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });
}
