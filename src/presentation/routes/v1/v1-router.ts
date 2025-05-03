import { FastifyInstance } from 'fastify';
import { functionsController } from '../../controllers/v1';

export async function v1Router(app: FastifyInstance) {
  await app.register(functionsController, { prefix: '/' });
}
