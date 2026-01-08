/**
 * Example echo handler
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export async function echoHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, any>;

  return reply.send({
    success: true,
    data: {
      echo: body,
      receivedAt: new Date().toISOString(),
      module: 'example-module',
    },
  });
}
