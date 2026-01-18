import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';

export interface ModuleContext {
    services: {
        prisma: PrismaClient;
        logger: FastifyBaseLogger;
        [key: string]: any;
    };
}
