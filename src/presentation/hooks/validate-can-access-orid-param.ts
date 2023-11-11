import { FastifyReply, FastifyRequest } from 'fastify';
import { v1 } from '@maddonkeysoftware/orid-node';

export function validateCanAccessOridParam(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: any) => void,
) {
  const logger = request.log;
  const hasOridInRequest = !!(request.params as { orid: string | undefined })
    .orid;
  if (hasOridInRequest) {
    // NOTE: Orid should be validated by other hook at this point.
    const orid = (request.params as { orid: string | undefined }).orid;
    const parsedOrid = v1.parse(orid!);

    const tokenAccountId = request.parsedToken?.payload.accountId;
    if (parsedOrid.custom3 !== tokenAccountId && tokenAccountId !== '1') {
      logger.debug(
        { tokenAccountId, requestAccount: parsedOrid.custom3 },
        'Insufficient privilege for request',
      );
      reply.status(403);
      reply.send();
      done(new Error('Insufficient privilege for request'));
      return;
    }
  }

  done();
}
