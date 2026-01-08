/**
 * Module loader service
 * Handles dynamic loading and unloading of module routes, jobs, and event handlers
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import { ModuleManifest, RouteDefinition } from '../types/module.types';
import { logger } from '../config/logger';

interface LoadedModule {
  name: string;
  routes: string[]; // List of registered route paths
  routePrefix: string;
}

export class ModuleLoaderService {
  private static loadedModules = new Map<string, LoadedModule>();
  private static MODULES_DIR = path.join(process.cwd(), 'modules');

  /**
   * Load a module's routes into the Fastify instance
   * Routes are namespaced under /api/v1/modules/:moduleName
   */
  static async loadModuleRoutes(
    app: FastifyInstance,
    moduleName: string,
    manifest: ModuleManifest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if module is already loaded
      if (this.loadedModules.has(moduleName)) {
        return {
          success: false,
          error: `Module ${moduleName} routes are already loaded`,
        };
      }

      const routePrefix = `/api/v1/modules/${moduleName}`;
      const loadedRoutes: string[] = [];

      // Load API routes if defined
      if (manifest.capabilities?.api?.routes) {
        logger.info(`Loading routes for module: ${moduleName}`);

        // Register module routes under a prefix
        await app.register(async (moduleApp) => {
          for (const route of manifest.capabilities.api!.routes) {
            try {
              // Create a simple route handler
              // In a real implementation, this would dynamically import the handler
              const handler = this.createRouteHandler(moduleName, route);

              // Register the route
              switch (route.method) {
                case 'GET':
                  moduleApp.get(route.path, handler);
                  break;
                case 'POST':
                  moduleApp.post(route.path, handler);
                  break;
                case 'PUT':
                  moduleApp.put(route.path, handler);
                  break;
                case 'PATCH':
                  moduleApp.patch(route.path, handler);
                  break;
                case 'DELETE':
                  moduleApp.delete(route.path, handler);
                  break;
              }

              loadedRoutes.push(`${route.method} ${routePrefix}${route.path}`);
              logger.info(`Registered route: ${route.method} ${routePrefix}${route.path}`);
            } catch (error) {
              logger.error(error, `Failed to load route: ${route.method} ${route.path}`);
            }
          }
        }, { prefix: routePrefix });

        logger.info(`Successfully loaded ${loadedRoutes.length} routes for ${moduleName}`);
      }

      // Store loaded module info
      this.loadedModules.set(moduleName, {
        name: moduleName,
        routes: loadedRoutes,
        routePrefix,
      });

      return { success: true };
    } catch (error) {
      logger.error(error, `Failed to load module routes: ${moduleName}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unload a module's routes
   * Note: Fastify doesn't support true route removal, so this marks them as unloaded
   * A server restart would be needed to fully remove routes
   */
  static async unloadModuleRoutes(
    moduleName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const loadedModule = this.loadedModules.get(moduleName);

      if (!loadedModule) {
        return {
          success: false,
          error: `Module ${moduleName} routes are not loaded`,
        };
      }

      // Remove from loaded modules
      this.loadedModules.delete(moduleName);

      logger.info(`Unloaded routes for module: ${moduleName}`);
      logger.warn(
        `Note: Routes are marked as unloaded but still exist in Fastify. Server restart recommended.`
      );

      return { success: true };
    } catch (error) {
      logger.error(error, `Failed to unload module routes: ${moduleName}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a route handler for a module route
   * Dynamically imports the handler from the module directory
   */
  private static createRouteHandler(moduleName: string, route: RouteDefinition) {
    return async (request: any, reply: any) => {
      // Check if module is still loaded
      if (!this.loadedModules.has(moduleName)) {
        return reply.status(503).send({
          success: false,
          error: {
            message: `Module ${moduleName} is not currently loaded`,
            statusCode: 503,
          },
        });
      }

      try {
        // Build the full path to the handler
        const modulePath = this.getModulePath(moduleName);
        const handlerPath = path.join(modulePath, route.handler);

        // Dynamically import the handler
        // Note: In production, handlers should be properly built/transpiled
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
        logger.error(error, `Failed to execute handler for ${moduleName}:${route.path}`);

        return reply.status(500).send({
          success: false,
          error: {
            message: `Failed to execute module handler: ${error instanceof Error ? error.message : 'Unknown error'}`,
            statusCode: 500,
          },
        });
      }
    };
  }

  /**
   * Extract handler function name from handler path
   * e.g., "handlers/hello.handler.js" -> "helloHandler"
   */
  private static getHandlerFunctionName(handlerPath: string): string {
    const filename = path.basename(handlerPath, path.extname(handlerPath));
    const parts = filename.split('.');
    const baseName = parts[0];

    // Convert kebab-case to camelCase and append "Handler"
    const camelCase = baseName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    return `${camelCase}Handler`;
  }

  /**
   * Get list of loaded modules
   */
  static getLoadedModules(): LoadedModule[] {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Check if a module is loaded
   */
  static isModuleLoaded(moduleName: string): boolean {
    return this.loadedModules.has(moduleName);
  }

  /**
   * Get module info
   */
  static getModuleInfo(moduleName: string): LoadedModule | undefined {
    return this.loadedModules.get(moduleName);
  }

  /**
   * Get module directory path
   */
  static getModulePath(moduleName: string): string {
    return path.join(this.MODULES_DIR, moduleName);
  }

  /**
   * Reload all enabled modules
   * This would be called on server startup
   */
  static async reloadAllModules(
    app: FastifyInstance,
    enabledModules: Array<{ name: string; manifest: ModuleManifest }>
  ): Promise<void> {
    logger.info(`Reloading ${enabledModules.length} enabled modules...`);

    for (const module of enabledModules) {
      try {
        await this.loadModuleRoutes(app, module.name, module.manifest);
        logger.info(`Reloaded module: ${module.name}`);
      } catch (error) {
        logger.error(error, `Failed to reload module: ${module.name}`);
      }
    }

    logger.info('Module reload complete');
  }
}
