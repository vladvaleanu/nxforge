/**
 * Module registry service
 * Handles module registration, storage, and retrieval
 */

import { prisma, Prisma, $Enums } from '../lib/prisma';
import {
  ModuleManifest,
  ModuleRegistryEntry,
  ModuleStatus,
  ModuleValidationResult,
} from '../types/module.types';
import { ModuleValidator } from './module-validator.service';
import semver from 'semver';

export class ModuleRegistryService {
  /**
   * Register a new module in the registry
   */
  static async register(
    manifest: ModuleManifest,
    options?: {
      path?: string;
      config?: Record<string, any>;
    }
  ): Promise<{ success: boolean; moduleId?: string; error?: string }> {
    try {
      // Validate manifest
      const validation = ModuleValidator.validate(manifest);
      if (!validation.valid) {
        return {
          success: false,
          error: `Manifest validation failed: ${validation.errors
            .map((e) => `${e.field}: ${e.message}`)
            .join(', ')}`,
        };
      }

      // Check if module already exists
      const existing = await prisma.module.findUnique({
        where: { name: manifest.name },
      });

      if (existing) {
        // Check version - only allow registration if new version is higher
        if (semver.lte(manifest.version, existing.version)) {
          return {
            success: false,
            error: `Module ${manifest.name} version ${existing.version} already registered. New version must be higher.`,
          };
        }

        // Update existing module with new version
        const updated = await prisma.module.update({
          where: { name: manifest.name },
          data: {
            version: manifest.version,
            displayName: manifest.displayName,
            description: manifest.description,
            author: manifest.author,
            manifest: manifest as unknown as Prisma.InputJsonValue,
            config: (options?.config ?? null) as Prisma.InputJsonValue,
            path: options?.path,
            status: $Enums.ModuleStatus.REGISTERED,
          },
        });

        return {
          success: true,
          moduleId: updated.id,
        };
      }

      // Create new module entry and register dependencies in a transaction
      const module = await prisma.$transaction(async (tx) => {
        const newModule = await tx.module.create({
          data: {
            name: manifest.name,
            version: manifest.version,
            displayName: manifest.displayName,
            description: manifest.description,
            author: manifest.author,
            manifest: manifest as unknown as Prisma.InputJsonValue,
            config: (options?.config ?? null) as Prisma.InputJsonValue,
            path: options?.path,
            status: $Enums.ModuleStatus.REGISTERED,
          },
        });

        // Register module dependencies if any
        if (manifest.dependencies?.modules) {
          for (const [depName, versionRange] of Object.entries(
            manifest.dependencies.modules
          )) {
            const depModule = await tx.module.findUnique({
              where: { name: depName },
            });

            if (!depModule) {
              throw new Error(`Dependency module '${depName}' not found. Please install it first.`);
            }

            await tx.moduleDependency.create({
              data: {
                moduleId: newModule.id,
                dependsOnId: depModule.id,
                versionRange,
              },
            });
          }
        }

        return newModule;
      });

      return {
        success: true,
        moduleId: module.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a module by name
   */
  static async getByName(name: string): Promise<ModuleRegistryEntry | null> {
    const module = await prisma.module.findUnique({
      where: { name },
      include: {
        dependencies: {
          include: {
            dependsOn: true,
          },
        },
        dependents: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!module) {
      return null;
    }

    return {
      id: module.id,
      name: module.name,
      version: module.version,
      displayName: module.displayName,
      description: module.description,
      author: (module.manifest as unknown as ModuleManifest)?.author || 'Unknown',
      status: module.status as ModuleStatus,
      manifest: module.manifest as unknown as ModuleManifest,
      installedAt: module.installedAt,
      enabledAt: module.enabledAt,
      disabledAt: module.disabledAt,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }

  /**
   * Get a module by ID
   */
  static async getById(id: string): Promise<ModuleRegistryEntry | null> {
    const module = await prisma.module.findUnique({
      where: { id },
    });

    if (!module) {
      return null;
    }

    return {
      id: module.id,
      name: module.name,
      version: module.version,
      displayName: module.displayName,
      description: module.description,
      author: (module.manifest as unknown as ModuleManifest)?.author || 'Unknown',
      status: module.status as ModuleStatus,
      manifest: module.manifest as unknown as ModuleManifest,
      installedAt: module.installedAt,
      enabledAt: module.enabledAt,
      disabledAt: module.disabledAt,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }

  /**
   * List all modules
   */
  static async list(filters?: {
    status?: ModuleStatus;
    search?: string;
  }): Promise<ModuleRegistryEntry[]> {
    const where: Prisma.ModuleWhereInput = {};

    if (filters?.status) {
      // Convert TypeScript enum to Prisma enum
      where.status = filters.status as unknown as $Enums.ModuleStatus;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const modules = await prisma.module.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return modules.map((module) => ({
      id: module.id,
      name: module.name,
      version: module.version,
      displayName: module.displayName,
      description: module.description,
      author: (module.manifest as unknown as ModuleManifest)?.author || 'Unknown',
      status: module.status as ModuleStatus,
      manifest: module.manifest as unknown as ModuleManifest,
      installedAt: module.installedAt,
      enabledAt: module.enabledAt,
      disabledAt: module.disabledAt,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    }));
  }

  /**
   * Update module status
   */
  static async updateStatus(
    name: string,
    status: ModuleStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert TypeScript enum to Prisma enum
      const data: Prisma.ModuleUpdateInput = {
        status: status as unknown as $Enums.ModuleStatus,
      };

      // Set timestamp based on status
      if (status === ModuleStatus.ENABLED) {
        data.enabledAt = new Date();
        data.disabledAt = null;
      } else if (status === ModuleStatus.DISABLED) {
        data.disabledAt = new Date();
      } else if (status === ModuleStatus.REGISTERED) {
        data.installedAt = new Date();
      }

      await prisma.module.update({
        where: { name },
        data,
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
   * Update module configuration
   */
  static async updateConfig(
    name: string,
    config: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get module to validate config against schema
      const module = await this.getByName(name);
      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      const manifest = module.manifest;

      // Validate config against schema if defined
      if (manifest.config?.schema) {
        for (const [key, value] of Object.entries(config)) {
          const fieldDef = manifest.config.schema[key];
          if (!fieldDef) {
            return {
              success: false,
              error: `Unknown config field: ${key}`,
            };
          }

          // Validate required fields
          if (fieldDef.required && (value === null || value === undefined)) {
            return {
              success: false,
              error: `Required config field missing: ${key}`,
            };
          }

          // Validate type
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          if (
            fieldDef.type !== valueType &&
            fieldDef.type !== 'password' &&
            value !== null
          ) {
            return {
              success: false,
              error: `Config field ${key} type mismatch. Expected ${fieldDef.type}, got ${valueType}`,
            };
          }
        }
      }

      await prisma.module.update({
        where: { name },
        data: { config: config as Prisma.InputJsonValue },
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
   * Remove a module from the registry
   */
  static async remove(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check dependencies and delete in a transaction to prevent race conditions
      await prisma.$transaction(async (tx) => {
        // Check if other modules depend on this one
        const module = await tx.module.findUnique({
          where: { name },
          include: {
            dependents: {
              include: {
                module: true,
              },
            },
          },
        });

        if (!module) {
          throw new Error('Module not found');
        }

        if (module.dependents.length > 0) {
          const dependentNames = module.dependents.map((d) => d.module.name).join(', ');
          throw new Error(`Cannot remove module. Other modules depend on it: ${dependentNames}`);
        }

        // Delete the module (dependencies will be cascade deleted)
        await tx.module.delete({
          where: { name },
        });
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
   * Validate module manifest
   */
  static validateManifest(manifest: unknown): ModuleValidationResult {
    return ModuleValidator.validate(manifest);
  }

  /**
   * Parse manifest from JSON string
   */
  static parseManifest(manifestJson: string): {
    manifest?: ModuleManifest;
    validation: ModuleValidationResult;
  } {
    return ModuleValidator.parseAndValidate(manifestJson);
  }
}
