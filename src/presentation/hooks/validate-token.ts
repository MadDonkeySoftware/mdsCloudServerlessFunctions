import config from 'config';
import { FastifyReply, FastifyRequest } from 'fastify';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { verify } from 'jsonwebtoken';
import { IdentityJwt } from '../types/identity-jwt';

export async function validateToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = request.headers.token as string | undefined;
  if (!token) {
    request.log.debug('Request missing token.');
    reply.status(403);
    reply.header('content-type', 'text/plain');
    reply.send('Please include authentication token in header "token"');
    throw new Error('Missing Authentication Token');
  }

  let parsedToken: IdentityJwt | undefined;
  try {
    const publicSignature = await (
      await MdsSdk.getIdentityServiceClient()
    ).getPublicSignature();
    parsedToken = verify(token, publicSignature.signature, {
      complete: true,
    }) as IdentityJwt;
  } catch (err) {
    request.log.debug({ err }, 'Error detected while parsing token.');
    reply.status(403);
    reply.send();
    throw err;
  }

  if (
    parsedToken &&
    parsedToken.payload.iss === config.get<string>('oridProviderKey')
  ) {
    request.parsedToken = parsedToken;
  } else {
    request.log.debug({ token: parsedToken }, 'Invalid token detected.');
    reply.status(403);
    reply.send();
    throw new Error('Invalid Authentication Token');
  }
}
