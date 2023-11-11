import { FastifyInstance } from 'fastify';
import { healthCheckController } from '../controllers';
import { v1Router } from './v1/v1-router';

export async function rootRouter(app: FastifyInstance): Promise<void> {
  await app.register(healthCheckController, { prefix: '/health' });
  await app.register(v1Router, { prefix: '/v1' });
}
