/**
 * Example status handler
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export async function statusHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    success: true,
    data: {
      status: 'operational',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      module: 'example-module',
      version: '1.0.0',
    },
  });
}
