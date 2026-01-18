/**
 * Module Loader Service
 * Handles dynamic loading and unloading of modules at runtime
 */

import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ModuleValidator } from './module-validator.service.js';
import type { ModuleManifest, ModuleContext } from '../types/module.types.js';
import { prisma, Prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { MigrationRunnerService } from './migration-runner.service.js';
import { jobExecutorService } from './job-executor.service.js';
import { eventBusService } from './event-bus.service.js';

// ============================================================================
// Types
// ============================================================================

interface LoadedModule {
  manifest: ModuleManifest;
  plugin: FastifyPluginCallback | null;
  registeredRoutes: string[];
  registeredJobs: string[];
}

// ============================================================================
// Module Loader Service
// ============================================================================

export class ModuleLoaderService {
  private static loadedModules: Map<string, LoadedModule> = new Map();
  private static app: FastifyInstance | null = null;

  /**
   * Initialize the module loader with Fastify instance
   */
  static initialize(app: FastifyInstance): void {
    this.app = app;
    logger.info('Module loader initialized');
  }

  /**
   * Load a module by name
   */
  static async loadModule(moduleName: string): Promise<void> {
    if (!this.app) {
      throw new Error('Module loader not initialized. Call initialize() first.');
    }

    logger.info(`Loading module: ${moduleName}`);

    try {
      // Get module from database
      const moduleRecord = await prisma.module.findUnique({
        where: { name: moduleName },
      });

      if (!moduleRecord) {
        throw new Error(`Module not found: ${moduleName}`);
      }

      // Check if already loaded
      if (this.loadedModules.has(moduleName)) {
        logger.warn(`Module ${moduleName} is already loaded`);
        return;
      }

      // Read and validate manifest
      const manifest = await this.readManifest(moduleName, moduleRecord.path || undefined);
      await this.validateManifest(manifest);

      // Get module directory
      const moduleDir = moduleRecord.path || path.join(process.cwd(), '..', '..', 'modules', moduleName);

      // Run database migrations if specified
      if (manifest.migrations) {
        await this.runMigrations(moduleName, moduleRecord.version, manifest, moduleDir);
      }

      // Build module context with all required parameters
      const moduleContext = this.buildModuleContext(
        moduleRecord.id,
        moduleName,
        moduleRecord.version,
        moduleRecord.config as Record<string, unknown> | undefined
      );

      // Load and register module plugin or routes
      const plugin = await this.loadModulePlugin(moduleName, manifest, moduleDir);
      let registeredRoutes: string[] = [];

      if (plugin && typeof plugin === 'function') {
        // Plugin-based approach (recommended)
        const prefix = `/api/v1/m/${moduleName}`;
        await this.app.register(plugin, { prefix });
        logger.info(`Registered module plugin: ${moduleName} at ${prefix}`);
        registeredRoutes = [`Plugin registered at ${prefix}`];
      } else if (manifest.routes && manifest.routes.length > 0) {
        // Fallback to manifest-based routes (legacy support)
        logger.warn(
          `Module ${moduleName} using legacy manifest-based routes. ` +
          `Consider migrating to plugin-based approach (see docs/MODULE_DEVELOPMENT.md)`
        );
        registeredRoutes = await this.registerRoutes(moduleName, manifest, moduleDir, moduleContext);
      } else {
        throw new Error(
          `Module ${moduleName} has no routes or plugin. ` +
          `Entry point should export a Fastify plugin or manifest should define routes.`
        );
      }

      // Register jobs
      const registeredJobs = await this.registerJobs(moduleName, manifest, moduleRecord.id);

      // Store loaded module info
      this.loadedModules.set(moduleName, {
        manifest,
        plugin,
        registeredRoutes,
        registeredJobs,
      });

      // Update module status in database
      await prisma.module.update({
        where: { name: moduleName },
        data: {
          status: 'ENABLED',
          enabledAt: new Date(),
        },
      });

      logger.info(`Module loaded successfully: ${moduleName}`, {
        routes: registeredRoutes.length,
        jobs: registeredJobs.length,
      });

      // Emit module loaded event
      await eventBusService.emit('module.loaded', {
        moduleName,
        version: manifest.version,
        routes: registeredRoutes.length,
        jobs: registeredJobs.length,
        source: 'system',
      });
    } catch (error) {
      logger.error(`Failed to load module ${moduleName}:`, error);

      // Don't update status if it's a Fastify "already booted" error
      // The status was already set to ENABLED by the caller and should remain
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Root plugin has already booted')) {
        // Update status to REGISTERED for other errors
        await prisma.module.update({
          where: { name: moduleName },
          data: { status: 'REGISTERED' },
        }).catch((updateError) => {
          logger.error(`Failed to reset module status after load failure: ${moduleName}`, { updateError });
        });
      }

      throw error;
    }
  }

  /**
   * Unload a module
   */
  static async unloadModule(moduleName: string): Promise<void> {
    logger.info(`Unloading module: ${moduleName}`);

    try {
      // Get module record from database first
      const moduleRecord = await prisma.module.findUnique({ where: { name: moduleName } });
      if (!moduleRecord) {
        throw new Error(`Module ${moduleName} not found in database`);
      }

      const loadedModule = this.loadedModules.get(moduleName);
      if (!loadedModule) {
        logger.warn(`Module ${moduleName} is not loaded in memory, only updating database status`);
        // Module not loaded in memory, but still update database status
        await prisma.module.update({
          where: { name: moduleName },
          data: {
            status: 'DISABLED',
            disabledAt: new Date(),
          },
        });

        // Clear job handler cache for this module
        jobExecutorService.clearCache(moduleRecord.id);
        logger.info(`Cleared job handler cache for module: ${moduleName}`);

        logger.info(`Module status updated to DISABLED: ${moduleName}`);
        return;
      }

      // Unregister jobs
      await this.unregisterJobs(moduleRecord.id, loadedModule.registeredJobs);

      // Clear job handler cache for this module
      jobExecutorService.clearCache(moduleRecord.id);
      logger.info(`Cleared job handler cache for module: ${moduleName}`);

      // Note: Fastify doesn't support dynamic route removal
      // Routes will remain but we mark the module as disabled

      // Remove from loaded modules
      this.loadedModules.delete(moduleName);

      // Update module status
      await prisma.module.update({
        where: { name: moduleName },
        data: {
          status: 'DISABLED',
          disabledAt: new Date(),
        },
      });

      logger.info(`Module unloaded successfully: ${moduleName}`);

      // Emit module unloaded event
      await eventBusService.emit('module.unloaded', {
        moduleName,
        source: 'system',
      });
    } catch (error) {
      logger.error(`Failed to unload module ${moduleName}:`, error);
      throw error;
    }
  }

  /**
   * Reload a module (unload then load)
   */
  static async reloadModule(moduleName: string): Promise<void> {
    logger.info(`Reloading module: ${moduleName}`);
    await this.unloadModule(moduleName);
    await this.loadModule(moduleName);
  }

  /**
   * Load all enabled modules from database
   */
  static async loadEnabledModules(): Promise<void> {
    logger.info('Loading enabled modules...');

    const enabledModules = await prisma.module.findMany({
      where: {
        status: { in: ['ENABLED', 'REGISTERED'] },
      },
    });

    if (enabledModules.length === 0) {
      logger.info('No enabled modules to load');
      return;
    }

    logger.info(`Found ${enabledModules.length} enabled module(s)`);

    for (const module of enabledModules) {
      try {
        await this.loadModule(module.name);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to load module ${module.name}: ${errorMessage}`);
        // Continue loading other modules
      }
    }
  }

  /**
   * Get loaded module info
   */
  static getLoadedModule(moduleName: string): LoadedModule | undefined {
    return this.loadedModules.get(moduleName);
  }

  /**
   * Get all loaded modules
   */
  static getLoadedModules(): Map<string, LoadedModule> {
    return this.loadedModules;
  }

  /**
   * Check if module is loaded
   */
  static isModuleLoaded(moduleName: string): boolean {
    return this.loadedModules.has(moduleName);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Read module manifest from filesystem
   */
  private static async readManifest(
    moduleName: string,
    modulePath?: string
  ): Promise<ModuleManifest> {
    const baseDir = modulePath || path.join(process.cwd(), 'modules', moduleName);
    const manifestPath = path.join(baseDir, 'manifest.json');

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      return manifest as ModuleManifest;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read manifest for ${moduleName}: ${errorMessage}`);
    }
  }

  /**
   * Validate module manifest
   */
  private static async validateManifest(manifest: ModuleManifest): Promise<void> {
    const result = ModuleValidator.validate(manifest);

    if (!result.valid) {
      const errorMessages = result.errors.map(e =>
        typeof e === 'string' ? e : `${e.field}: ${e.message}`
      );
      throw new Error(`Manifest validation failed:\n${errorMessages.join('\n')}`);
    }

    if (result.warnings && result.warnings.length > 0) {
      logger.warn(`Manifest validation warnings for ${manifest.name}:`, result.warnings);
    }
  }

  /**
   * Validate path to prevent directory traversal attacks
   */
  private static validatePath(basePath: string, targetPath: string): void {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(basePath, targetPath);

    // Ensure the resolved target path starts with the base path
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      throw new Error(`Path traversal detected: ${targetPath} attempts to access outside module directory`);
    }

    // Additional check: ensure no '..' in the normalized path
    const normalizedPath = path.normalize(targetPath);
    if (normalizedPath.includes('..')) {
      throw new Error(`Invalid path: ${targetPath} contains directory traversal sequences`);
    }
  }

  /**
   * Load module plugin (backend entry point)
   */
  private static async loadModulePlugin(
    moduleName: string,
    manifest: ModuleManifest,
    moduleDir: string
  ): Promise<FastifyPluginCallback | null> {
    // Validate manifest.entry to prevent path traversal
    this.validatePath(moduleDir, manifest.entry);

    let pluginPath = path.join(moduleDir, manifest.entry);

    try {
      // For TypeScript files in development, convert .ts to use file:// URL
      // tsx (which runs the backend in dev mode) can handle this
      if (pluginPath.endsWith('.ts')) {
        pluginPath = `file://${pluginPath}`;
      }

      // Dynamic import of the module
      const plugin = await import(pluginPath);
      return plugin.default || plugin;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load plugin for ${moduleName}: ${errorMessage}`);
    }
  }

  /**
   * Register module routes with Fastify
   */
  private static async registerRoutes(
    moduleName: string,
    manifest: ModuleManifest,
    moduleDir: string,
    moduleContext: ModuleContext
  ): Promise<string[]> {
    if (!this.app) {
      throw new Error('Fastify app not initialized');
    }

    const registeredRoutes: string[] = [];
    const prefix = `/api/v1/m/${moduleName}`;

    for (const route of manifest.routes || []) {
      try {
        // Validate route.handler to prevent path traversal
        if (route.handler) {
          this.validatePath(moduleDir, route.handler);
        }

        let handlerPath = path.join(moduleDir, route.handler || '');

        // For TypeScript files in development, convert .ts to use file:// URL
        if (handlerPath.endsWith('.ts')) {
          handlerPath = `file://${handlerPath}`;
        }

        // Import route handler
        const handler = await import(handlerPath);
        const routeFunction = handler.default || handler.registerRoutes || handler;

        // Register as Fastify plugin with prefix and context
        await this.app.register(
          async (fastify: FastifyInstance) => {
            await routeFunction(fastify, moduleContext);
          },
          { prefix }
        );

        const fullPath = `${route.method} ${prefix}${route.path}`;
        registeredRoutes.push(fullPath);

        logger.debug(`Registered route: ${fullPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to register route ${route.method} ${route.path}: ${errorMessage}`);
        throw error;
      }
    }

    return registeredRoutes;
  }

  /**
   * Register module jobs
   */
  private static async registerJobs(
    moduleName: string,
    manifest: ModuleManifest,
    moduleId: string
  ): Promise<string[]> {
    const registeredJobs: string[] = [];

    // Skip if no jobs defined
    if (!manifest.jobs) {
      return registeredJobs;
    }

    for (const [jobName, jobDef] of Object.entries(manifest.jobs)) {
      try {
        // Check if job already exists
        const existingJob = await prisma.job.findFirst({
          where: {
            moduleId: moduleId,
            name: jobName,
          },
        });

        if (existingJob) {
          // Update existing job
          await prisma.job.update({
            where: { id: existingJob.id },
            data: {
              description: jobDef.description,
              handler: jobDef.handler,
              schedule: jobDef.schedule,
              timeout: jobDef.timeout || 300000,
              retries: jobDef.retries || 3,
              config: (jobDef.config as unknown as Prisma.JsonValue) || Prisma.JsonNull,
              enabled: true,
            },
          });
        } else {
          // Create new job
          await prisma.job.create({
            data: {
              moduleId: moduleId,
              name: jobName,
              description: jobDef.description,
              handler: jobDef.handler,
              schedule: jobDef.schedule,
              timeout: jobDef.timeout || 300000,
              retries: jobDef.retries || 3,
              config: (jobDef.config as unknown as Prisma.JsonValue) || Prisma.JsonNull,
              enabled: true,
            },
          });
        }

        registeredJobs.push(jobName);
        logger.debug(`Registered job: ${moduleName}.${jobName}`);
      } catch (error) {
        logger.error(`Failed to register job ${jobName}:`, error);
        // Continue with other jobs
      }
    }

    return registeredJobs;
  }

  /**
   * Unregister module jobs
   */
  private static async unregisterJobs(
    moduleId: string,
    jobNames: string[]
  ): Promise<void> {
    for (const jobName of jobNames) {
      try {
        await prisma.job.updateMany({
          where: {
            moduleId: moduleId,
            name: jobName,
          },
          data: {
            enabled: false,
          },
        });

        logger.debug(`Unregistered job: ${jobName}`);
      } catch (error) {
        logger.error(`Failed to unregister job ${jobName}:`, error);
      }
    }
  }

  /**
   * Run database migrations for a module
   */
  private static async runMigrations(
    moduleName: string,
    moduleVersion: string,
    manifest: ModuleManifest,
    moduleDir: string
  ): Promise<void> {
    if (!manifest.migrations) {
      return;
    }

    const migrationsDir = path.join(moduleDir, manifest.migrations);

    logger.info(`Running migrations for module: ${moduleName}`);

    try {
      const results = await MigrationRunnerService.runModuleMigrations(
        moduleName,
        moduleVersion,
        migrationsDir
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} migration(s) failed: ${failed.map(r => r.filename).join(', ')}`
        );
      }

      if (results.length > 0) {
        logger.info(`Applied ${results.length} migration(s) for ${moduleName}`);
      }
    } catch (error) {
      logger.error(`Migration failed for ${moduleName}:`, error);
      throw error;
    }
  }

  /**
   * Get module statistics
   */
  static getStats() {
    return {
      loadedModules: this.loadedModules.size,
      modules: Array.from(this.loadedModules.keys()),
    };
  }

  /**
   * Build module context with services
   */
  private static buildModuleContext(
    moduleId: string,
    moduleName: string,
    moduleVersion: string,
    moduleConfig?: Record<string, unknown>
  ): ModuleContext {
    return {
      module: {
        id: moduleId,
        name: moduleName,
        version: moduleVersion,
        config: moduleConfig,
      },
      services: {
        prisma,
        logger,
        // Additional services can be added here as needed
      },
    };
  }
}
