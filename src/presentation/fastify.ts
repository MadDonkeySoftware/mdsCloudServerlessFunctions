import { IdentityJwt } from './types/identity-jwt';
import { Logic } from '../core/classes/logic';

/**
 * Extensions to the base fastify types.
 */
declare module 'fastify' {
  interface FastifyRequest {
    parsedToken?: IdentityJwt;
    services: {
      logic: Logic;
    };
  }
}
