import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { GetHealthResponseSchema } from '../schemas';
import { HealthCheckResult } from '../../core/types/health-check-result';

export function healthCheckController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  app.get<{
    Body: any;
  }>(
    '/',
    {
      schema: {
        description: 'Health check',
        tags: ['X-HIDDEN'],
        response: {
          200: GetHealthResponseSchema,
        },
      },
    },
    async (request, response) => {
      response.status(200);
      response.send({ serverStatus: HealthCheckResult.OK });
    },
  );

  done();
}
