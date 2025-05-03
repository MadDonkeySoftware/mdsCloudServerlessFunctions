import { FastifyReply, FastifyRequest } from 'fastify';
import { v1 } from '@maddonkeysoftware/orid-node';

export function validateRequestOridParam(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: any) => void,
) {
  const hasOridInRequest = !!(request.params as { orid: string | undefined })
    .orid;
  if (hasOridInRequest) {
    // NOTE: Orid should have a value at this point.
    const orid = (request.params as { orid: string | undefined }).orid;
    const parsedOrid = v1.isValid(orid!) ? v1.parse(orid!) : undefined;

    if (!parsedOrid) {
      reply.status(400);
      reply.header('content-type', 'text/plain');
      reply.send('Resource not understood');
      request.log.debug(
        {
          orid,
          parsedOrid,
        },
        'Resource not understood',
      );
      done(new Error('Missing or malformed ORID'));
      return;
    }
  }

  done();
}
