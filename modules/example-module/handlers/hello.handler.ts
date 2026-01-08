/**
 * Example hello handler
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export async function helloHandler(request: FastifyRequest, reply: FastifyReply) {
  const { name } = request.query as { name?: string };

  return reply.send({
    success: true,
    data: {
      message: name ? `Hello, ${name}!` : 'Hello, World!',
      timestamp: new Date().toISOString(),
      module: 'example-module',
    },
  });
}
