/**
 * Module router service
 * Handles routing requests to enabled module handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import { ModuleManifest, RouteDefinition } from '../types/module.types';
import { logger } from '../config/logger';

interface EnabledModule {
  name: string;
  manifest: ModuleManifest;
  routes: Map<string, RouteDefinition>; // key: "METHOD:path"
}

export class ModuleRouterService {
  private static enabledModules = new Map<string, EnabledModule>();
  // Modules are in the monorepo root, not in the backend package
  private static MODULES_DIR = path.join(process.cwd(), '..', '..', 'modules');

  /**
   * Enable a module and register its routes
   */
  static enableModule(moduleName: string, manifest: ModuleManifest): void {
    const routes = new Map<string, RouteDefinition>();

    if (manifest.capabilities?.api?.routes) {
      for (const route of manifest.capabilities.api.routes) {
        const routeKey = `${route.method}:${route.path}`;
        routes.set(routeKey, route);
      }
    }

    this.enabledModules.set(moduleName, {
      name: moduleName,
      manifest,
      routes,
    });

    logger.info(`Module ${moduleName} enabled with ${routes.size} routes`);
  }

  /**
   * Disable a module
   */
  static disableModule(moduleName: string): void {
    this.enabledModules.delete(moduleName);
    logger.info(`Module ${moduleName} disabled`);
  }

  /**
   * Check if a module is enabled
   */
  static isModuleEnabled(moduleName: string): boolean {
    return this.enabledModules.has(moduleName);
  }

  /**
   * Get all enabled modules
   */
  static getEnabledModules(): string[] {
    return Array.from(this.enabledModules.keys());
  }

  /**
   * Route handler for module requests
   * This is registered as a wildcard route at server startup
   */
  static async handleModuleRequest(
    request: FastifyRequest<{ Params: { moduleName: string; '*': string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { moduleName } = request.params;
    const wildcardPath = (request.params as any)['*'] || '/';
    const routePath = wildcardPath.startsWith('/') ? wildcardPath : `/${wildcardPath}`;
    const method = request.method;

    // Check if module is enabled
    const module = this.enabledModules.get(moduleName);
    if (!module) {
      return reply.status(503).send({
        success: false,
        error: {
          message: `Module ${moduleName} is not currently enabled`,
          statusCode: 503,
        },
      });
    }

    // Find matching route
    const routeKey = `${method}:${routePath}`;
    const route = module.routes.get(routeKey);

    if (!route) {
      return reply.status(404).send({
        success: false,
        error: {
          message: `Route ${method} ${routePath} not found in module ${moduleName}`,
          statusCode: 404,
        },
      });
    }

    try {
      // Build the full path to the handler
      const modulePath = path.join(this.MODULES_DIR, moduleName);
      const handlerPath = path.join(modulePath, route.handler);

      // Dynamically import the handler
      const handlerModule = await import(handlerPath);

      // Get the handler function (try common export patterns)
      const handler =
        handlerModule.default ||
        handlerModule[this.getHandlerFunctionName(route.handler)] ||
        Object.values(handlerModule)[0];

      if (typeof handler !== 'function') {
        throw new Error(`Handler at ${route.handler} is not a function`);
      }

      // Execute the handler
      return await handler(request, reply);
    } catch (error) {
      logger.error(error, `Failed to execute handler for ${moduleName}:${routePath}`);

      return reply.status(500).send({
        success: false,
        error: {
          message: `Failed to execute module handler: ${error instanceof Error ? error.message : 'Unknown error'}`,
          statusCode: 500,
        },
      });
    }
  }

  /**
   * Extract handler function name from handler path
   */
  private static getHandlerFunctionName(handlerPath: string): string {
    const filename = path.basename(handlerPath, path.extname(handlerPath));
    const parts = filename.split('.');
    const baseName = parts[0];

    // Convert kebab-case to camelCase and append "Handler"
    const camelCase = baseName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    return `${camelCase}Handler`;
  }
}
