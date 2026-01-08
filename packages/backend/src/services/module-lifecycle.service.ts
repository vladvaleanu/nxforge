/**
 * Module lifecycle management service
 * Handles install, enable, disable, update, and remove operations
 */

import { ModuleRegistryService } from './module-registry.service';
import { ModuleStatus } from '../types/module.types';
import { prisma } from '../lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export class ModuleLifecycleService {
  private static MODULES_DIR = path.join(process.cwd(), 'modules');

  /**
   * Initialize modules directory
   */
  static async ensureModulesDirectory(): Promise<void> {
    try {
      await fs.access(this.MODULES_DIR);
    } catch {
      await fs.mkdir(this.MODULES_DIR, { recursive: true });
    }
  }

  /**
   * Install a module from uploaded files
   * Extracts module, validates manifest, and registers it
   */
  static async install(
    moduleName: string,
    files?: { path: string; filename: string }
  ): Promise<{ success: boolean; moduleId?: string; error?: string }> {
    try {
      // Ensure modules directory exists
      await this.ensureModulesDirectory();

      // Check if module already exists
      const existing = await ModuleRegistryService.getByName(moduleName);
      if (existing && existing.status !== ModuleStatus.REGISTERED) {
        return {
          success: false,
          error: `Module ${moduleName} is already installed with status: ${existing.status}`,
        };
      }

      // Update status to INSTALLING
      if (existing) {
        await ModuleRegistryService.updateStatus(moduleName, ModuleStatus.INSTALLING);
      }

      // If files provided, extract them to modules directory
      let modulePath: string | undefined;
      if (files) {
        const moduleDir = path.join(this.MODULES_DIR, moduleName);
        await fs.mkdir(moduleDir, { recursive: true });

        // Copy uploaded file to module directory
        await fs.copyFile(files.path, path.join(moduleDir, files.filename));
        modulePath = moduleDir;
      }

      // Update module with installed status and path
      await prisma.module.update({
        where: { name: moduleName },
        data: {
          status: ModuleStatus.DISABLED,
          installedAt: new Date(),
          path: modulePath,
        },
      });

      const module = await ModuleRegistryService.getByName(moduleName);

      return {
        success: true,
        moduleId: module?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enable a module
   * Makes the module active and loads its capabilities
   */
  static async enable(moduleName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const module = await ModuleRegistryService.getByName(moduleName);

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      // Check current status
      if (module.status === ModuleStatus.ENABLED) {
        return { success: false, error: 'Module is already enabled' };
      }

      if (module.status === ModuleStatus.REGISTERED) {
        return {
          success: false,
          error: 'Module must be installed before enabling. Use install endpoint first.',
        };
      }

      // Check dependencies are enabled
      const deps = await prisma.moduleDependency.findMany({
        where: { moduleId: module.id },
        include: { dependsOn: true },
      });

      for (const dep of deps) {
        if (dep.dependsOn.status !== ModuleStatus.ENABLED) {
          return {
            success: false,
            error: `Dependency ${dep.dependsOn.name} must be enabled first`,
          };
        }
      }

      // Enable the module
      await ModuleRegistryService.updateStatus(moduleName, ModuleStatus.ENABLED);

      // TODO: Load module routes, jobs, and event handlers dynamically
      // This will be implemented in the next step

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disable a module
   * Deactivates the module and unloads its capabilities
   */
  static async disable(moduleName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const module = await ModuleRegistryService.getByName(moduleName);

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      if (module.status === ModuleStatus.DISABLED) {
        return { success: false, error: 'Module is already disabled' };
      }

      if (module.status !== ModuleStatus.ENABLED) {
        return {
          success: false,
          error: `Cannot disable module with status: ${module.status}`,
        };
      }

      // Check if other modules depend on this one
      const dependents = await prisma.moduleDependency.findMany({
        where: { dependsOnId: module.id },
        include: { module: true },
      });

      const enabledDependents = dependents.filter(
        (d) => d.module.status === ModuleStatus.ENABLED
      );

      if (enabledDependents.length > 0) {
        const names = enabledDependents.map((d) => d.module.name).join(', ');
        return {
          success: false,
          error: `Cannot disable. Other enabled modules depend on it: ${names}`,
        };
      }

      // Disable the module
      await ModuleRegistryService.updateStatus(moduleName, ModuleStatus.DISABLED);

      // TODO: Unload module routes, jobs, and event handlers
      // This will be implemented in the next step

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a module to a new version
   * Uploads new files and updates the module
   */
  static async update(
    moduleName: string,
    newVersion: string,
    files?: { path: string; filename: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const module = await ModuleRegistryService.getByName(moduleName);

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      // Validate version is higher
      const semver = await import('semver');
      if (!semver.gt(newVersion, module.version)) {
        return {
          success: false,
          error: `New version ${newVersion} must be greater than current version ${module.version}`,
        };
      }

      // Set status to UPDATING
      await ModuleRegistryService.updateStatus(moduleName, ModuleStatus.UPDATING);

      // If new files provided, replace the old ones
      if (files && module.manifest.name) {
        const moduleDir = path.join(this.MODULES_DIR, module.manifest.name);

        // Backup old version
        const backupDir = path.join(moduleDir, `backup-${module.version}`);
        await fs.mkdir(backupDir, { recursive: true });

        try {
          const existingFiles = await fs.readdir(moduleDir);
          for (const file of existingFiles) {
            if (!file.startsWith('backup-')) {
              await fs.rename(
                path.join(moduleDir, file),
                path.join(backupDir, file)
              );
            }
          }
        } catch (err) {
          // Ignore if no existing files
        }

        // Copy new files
        await fs.copyFile(files.path, path.join(moduleDir, files.filename));
      }

      // Update module version
      await prisma.module.update({
        where: { name: moduleName },
        data: {
          version: newVersion,
          status: module.status === ModuleStatus.ENABLED
            ? ModuleStatus.ENABLED
            : ModuleStatus.DISABLED,
          updatedAt: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a module completely
   * Deletes files and removes from registry
   */
  static async remove(moduleName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const module = await ModuleRegistryService.getByName(moduleName);

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      // Check if enabled - must be disabled first
      if (module.status === ModuleStatus.ENABLED) {
        return {
          success: false,
          error: 'Module must be disabled before removal',
        };
      }

      // Set status to REMOVING
      await ModuleRegistryService.updateStatus(moduleName, ModuleStatus.REMOVING);

      // Delete module files if they exist
      if (module.manifest.name) {
        const moduleDir = path.join(this.MODULES_DIR, module.manifest.name);
        try {
          await fs.rm(moduleDir, { recursive: true, force: true });
        } catch (err) {
          // Ignore if directory doesn't exist
        }
      }

      // Remove from registry (this also removes dependencies via cascade)
      const result = await ModuleRegistryService.remove(moduleName);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get module directory path
   */
  static getModulePath(moduleName: string): string {
    return path.join(this.MODULES_DIR, moduleName);
  }
}
