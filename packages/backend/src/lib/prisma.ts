/**
 * Prisma client singleton
 */

import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { logger } from '../config/logger';

// Re-export Prisma namespace and enums for types
export { PrismaClient, Prisma, $Enums };

// Re-export specific enums for convenience
export type PrismaModuleStatus = $Enums.ModuleStatus;
export type PrismaJobExecutionStatus = $Enums.JobExecutionStatus;

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Log queries in development
prisma.$on('query', (e) => {
  logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Database query');
});

prisma.$on('error', (e) => {
  logger.error({ target: e.target, message: e.message }, 'Database error');
});

prisma.$on('warn', (e) => {
  logger.warn({ target: e.target, message: e.message }, 'Database warning');
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
