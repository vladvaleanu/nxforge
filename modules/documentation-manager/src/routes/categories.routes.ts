/**
 * Categories Routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// import { prisma } from '../lib/prisma';

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  order: z.number().optional(),
});

// ... imports
import { ModuleContext } from '../types';

// ... schemas

export async function categoriesRoutes(app: FastifyInstance, context: ModuleContext) {
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

  /**
   * GET /api/v1/docs/categories
   * List all categories
   */
  app.get('/', async (request, reply) => {
    try {
      const categories = await prisma.$queryRaw<Array<any>>`
        SELECT
          c.*,
          COUNT(DISTINCT d.id)::int as document_count
        FROM document_categories c
        LEFT JOIN documents d ON c.id = d.category_id
        GROUP BY c.id
        ORDER BY c."order" ASC, c.name ASC
      `;

      reply.send({
        success: true,
        data: categories,
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
   * GET /api/v1/docs/categories/:id
   * Get category details with documents
   */
  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const categories = await prisma.$queryRaw<Array<any>>`
        SELECT
          c.*,
          COUNT(DISTINCT d.id)::int as document_count,
          COUNT(DISTINCT f.id)::int as folder_count
        FROM document_categories c
        LEFT JOIN documents d ON c.id = d.category_id
        LEFT JOIN document_folders f ON c.id = f.category_id
        WHERE c.id = ${id}::uuid
        GROUP BY c.id
      `;

      if (categories.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Category not found', statusCode: 404 },
        });
      }

      reply.send({
        success: true,
        data: categories[0],
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
   * POST /api/v1/docs/categories
   * Create category (admin only)
   */
  app.post('/', async (request, reply) => {
    try {
      const data = createCategorySchema.parse(request.body);

      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO document_categories (name, description, icon, "order")
        VALUES (${data.name}, ${data.description || null}, ${data.icon || null}, ${data.order || 0})
        RETURNING id
      `;

      const categoryId = result[0].id;

      const categories = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM document_categories WHERE id = ${categoryId}::uuid
      `;

      reply.status(201).send({
        success: true,
        data: categories[0],
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
   * PUT /api/v1/docs/categories/:id
   * Update category (admin only)
   */
  app.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateCategorySchema.parse(request.body);

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(data.name);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(data.description);
        paramIndex++;
      }

      if (data.icon !== undefined) {
        updates.push(`icon = $${paramIndex}`);
        values.push(data.icon);
        paramIndex++;
      }

      if (data.order !== undefined) {
        updates.push(`"order" = $${paramIndex}`);
        values.push(data.order);
        paramIndex++;
      }

      if (updates.length === 0) {
        const categories = await prisma.$queryRaw<Array<any>>`
          SELECT * FROM document_categories WHERE id = ${id}::uuid
        `;
        return reply.send({
          success: true,
          data: categories[0],
        });
      }

      updates.push(`updated_at = NOW()`);

      await prisma.$executeRawUnsafe(`
        UPDATE document_categories
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}::uuid
      `, ...values, id);

      const categories = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM document_categories WHERE id = ${id}::uuid
      `;

      reply.send({
        success: true,
        data: categories[0],
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
   * DELETE /api/v1/docs/categories/:id
   * Delete category (admin only)
   */
  app.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Check if category has documents
      const count = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count FROM documents WHERE category_id = ${id}::uuid
      `;

      if (count[0].count > 0) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Cannot delete category with documents', statusCode: 400 },
        });
      }

      await prisma.$executeRaw`
        DELETE FROM document_categories WHERE id = ${id}::uuid
      `;

      reply.send({
        success: true,
        data: { message: 'Category deleted successfully' },
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
