/**
 * Module registry API routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ModuleRegistryService } from '../services/module-registry.service';
import { ModuleStatus } from '../types/module.types';
import { authenticate } from '../middleware/auth.middleware';

interface RegisterModuleBody {
  manifest: any; // Will be validated by the service
  config?: Record<string, any>;
  path?: string;
}

interface UpdateStatusBody {
  status: ModuleStatus;
}

interface UpdateConfigBody {
  config: Record<string, any>;
}

interface ListModulesQuery {
  status?: ModuleStatus;
  search?: string;
}

export async function modulesRoutes(app: FastifyInstance) {
  // Apply authentication to all module routes
  app.addHook('onRequest', authenticate);

  /**
   * GET /modules
   * List all modules with optional filtering
   */
  app.get<{ Querystring: ListModulesQuery }>(
    '/',
    {
      schema: {
        description: 'List all registered modules',
        tags: ['modules'],
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: Object.values(ModuleStatus),
            },
            search: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    version: { type: 'string' },
                    displayName: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    status: { type: 'string' },
                    installedAt: { type: 'string', nullable: true },
                    enabledAt: { type: 'string', nullable: true },
                    disabledAt: { type: 'string', nullable: true },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListModulesQuery }>, reply: FastifyReply) => {
      const modules = await ModuleRegistryService.list(request.query);

      return reply.send({
        success: true,
        data: modules,
        meta: {
          total: modules.length,
        },
      });
    }
  );

  /**
   * GET /modules/:name
   * Get a specific module by name
   */
  app.get<{ Params: { name: string } }>(
    '/:name',
    {
      schema: {
        description: 'Get module details by name',
        tags: ['modules'],
        params: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
      const module = await ModuleRegistryService.getByName(request.params.name);

      if (!module) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'Module not found',
            statusCode: 404,
          },
        });
      }

      return reply.send({
        success: true,
        data: module,
      });
    }
  );

  /**
   * POST /modules
   * Register a new module
   */
  app.post<{ Body: RegisterModuleBody }>(
    '/',
    {
      schema: {
        description: 'Register a new module',
        tags: ['modules'],
        body: {
          type: 'object',
          required: ['manifest'],
          properties: {
            manifest: { type: 'object' },
            config: { type: 'object' },
            path: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterModuleBody }>, reply: FastifyReply) => {
      const { manifest, config, path } = request.body;

      // First validate the manifest
      const validation = ModuleRegistryService.validateManifest(manifest);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            message: 'Manifest validation failed',
            statusCode: 400,
            details: validation.errors,
            warnings: validation.warnings,
          },
        });
      }

      // Register the module
      const result = await ModuleRegistryService.register(manifest, { config, path });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error,
            statusCode: 400,
          },
        });
      }

      // Get the full module details
      const module = await ModuleRegistryService.getById(result.moduleId!);

      return reply.status(201).send({
        success: true,
        data: module,
        meta: {
          warnings: validation.warnings,
        },
      });
    }
  );

  /**
   * PUT /modules/:name/status
   * Update module status (enable/disable)
   */
  app.put<{ Params: { name: string }; Body: UpdateStatusBody }>(
    '/:name/status',
    {
      schema: {
        description: 'Update module status',
        tags: ['modules'],
        params: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: Object.values(ModuleStatus),
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { name: string }; Body: UpdateStatusBody }>,
      reply: FastifyReply
    ) => {
      const { name } = request.params;
      const { status } = request.body;

      const result = await ModuleRegistryService.updateStatus(name, status);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error,
            statusCode: 400,
          },
        });
      }

      const module = await ModuleRegistryService.getByName(name);

      return reply.send({
        success: true,
        data: module,
      });
    }
  );

  /**
   * PUT /modules/:name/config
   * Update module configuration
   */
  app.put<{ Params: { name: string }; Body: UpdateConfigBody }>(
    '/:name/config',
    {
      schema: {
        description: 'Update module configuration',
        tags: ['modules'],
        params: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['config'],
          properties: {
            config: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { name: string }; Body: UpdateConfigBody }>,
      reply: FastifyReply
    ) => {
      const { name } = request.params;
      const { config } = request.body;

      const result = await ModuleRegistryService.updateConfig(name, config);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error,
            statusCode: 400,
          },
        });
      }

      const module = await ModuleRegistryService.getByName(name);

      return reply.send({
        success: true,
        data: module,
      });
    }
  );

  /**
   * DELETE /modules/:name
   * Remove a module from the registry
   */
  app.delete<{ Params: { name: string } }>(
    '/:name',
    {
      schema: {
        description: 'Remove a module from the registry',
        tags: ['modules'],
        params: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
      const { name } = request.params;

      const result = await ModuleRegistryService.remove(name);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error,
            statusCode: 400,
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          message: `Module ${name} removed successfully`,
        },
      });
    }
  );

  /**
   * POST /modules/validate
   * Validate a module manifest without registering
   */
  app.post<{ Body: { manifest: any } }>(
    '/validate',
    {
      schema: {
        description: 'Validate a module manifest',
        tags: ['modules'],
        body: {
          type: 'object',
          required: ['manifest'],
          properties: {
            manifest: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { manifest: any } }>, reply: FastifyReply) => {
      const { manifest } = request.body;

      const validation = ModuleRegistryService.validateManifest(manifest);

      return reply.send({
        success: validation.valid,
        data: validation,
      });
    }
  );
}
