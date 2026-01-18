/**
 * Documentation Manager Module - Backend Entry Point
 */

import { FastifyPluginAsync } from 'fastify';
import { documentsRoutes } from './routes/documents.routes';
import { categoriesRoutes } from './routes/categories.routes';
import { foldersRoutes } from './routes/folders.routes';
import { attachmentsRoutes } from './routes/attachments.routes';

import { ModuleContext } from './types';

const plugin: FastifyPluginAsync = async (app) => {
  // Routes will be registered under /api/v1/m/documentation-manager by the module loader
  // Note: We need to cast the route handler to any because Fastify typings don't strictly enforce the context argument 
  // without custom type augmentation, but the module loader calls it with (app, context).

  // However, since we are using the module loader's registerRoutes which calls:
  // await routeFunction(fastify, moduleContext);
  // We need to ensure documentsRoutes matches that signature.

  // But wait, src/index.ts IS the entry point. The module loader does:
  // await this.app.register(plugin, { prefix });

  // So 'plugin' here receives (app, opts). It DOES NOT receive context directly as a second argument in standard Fastify.
  // The module loader actually supports TWO modes:
  // 1. Plugin mode (entry exports default plugin): loaded via app.register(plugin). Context is NOT automatically passed unless using decorations.
  // 2. Route mode (manifest.routes): loaded via import(). module-loader calls handler(app, context).

  // Since we switched to Plugin mode (entry: src/index.ts), we don't get 'context' passedcriptively.
  // We need to access services via a shared singleton (bad for isolation) or via Fastify decorations.
  // The AI_DEVELOPMENT_GUIDE says: "Services available to modules: logger, prisma... injected via ModuleContext".

  // Inspecting module-loader.service.ts again:
  // Line 95: await this.app.register(plugin, { prefix });
  // It provides NO context to the plugin!

  // Checking how other modules work. If they use plugin mode, they might reference global services or expecting context in opts?
  // Let's check if we can get prisma from 'app.prisma' if it's decorated?
  // backend/src/types/fastify.d.ts might show decorations.

  // If not decorated, we might need a way to get context.

  // RE-READING module-loader.service.ts:
  // Line 105 (Fallback): await this.registerRoutes(...) -> calls routeFunction(fastify, moduleContext)

  // So Plugin mode is actually harder to use context with unless it's decorated on 'app'.

  app.log.info('[Documentation Manager] Module initialized');

  // We need to instantiate services. If we can't get context, we fallback to imports?
  // But the imports failed.

  // Let's assume 'app' has prisma decorated.
  const prisma = (app as any).prisma;

  if (!prisma) {
    app.log.error('Prisma instance not found on app decoration');
    throw new Error('Prisma instance not found on app decoration');
  }

  // Construct a minimal context for the services
  const context = {
    services: {
      prisma,
      logger: app.log
    }
  } as unknown as ModuleContext;

  app.log.info(`[Documentation Manager] Registering routes with context keys: ${Object.keys(context)}`);

  app.log.info('[Documentation Manager] Registering /documents');
  await app.register(documentsRoutes, { ...context, prefix: '/documents' });

  app.log.info('[Documentation Manager] Registering /categories');
  await app.register(categoriesRoutes, { ...context, prefix: '/categories' });

  app.log.info('[Documentation Manager] Registering /folders');
  await app.register(foldersRoutes, { ...context, prefix: '/folders' });

  app.log.info('[Documentation Manager] Registering /attachments');
  await app.register(attachmentsRoutes, { ...context, prefix: '/attachments' });
};

export default plugin;
