import { validateRequestOridParam } from '../validate-request-orid-param';
import { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityJwt } from '../../types/identity-jwt';

jest.mock('config', () => {
  const actualConfig = jest.requireActual('config');
  return {
    has: actualConfig.has,
    get: (key: string) => {
      if (key === 'oridProviderKey') return 'testIssuer';
      return actualConfig.get(key);
    },
  };
});

describe('validate-can-access-orid-param', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('invokes next middleware when no orid param', () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      params: Record<string, string>;
    } = {
      parsedToken: undefined,
      params: {},
    };
    const done = jest.fn();

    // Act
    validateRequestOridParam(
      request as FastifyRequest,
      {} as FastifyReply,
      done,
    );

    // Assert
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith();
  });

  it('invokes next middleware when valid orid in params', () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      params: Record<string, string>;
    } = {
      parsedToken: undefined,
      params: {
        orid: 'orid:1:testIssuer:::1234:qs:5678',
      },
    };
    const done = jest.fn();

    // Act
    validateRequestOridParam(
      request as FastifyRequest,
      {} as FastifyReply,
      done,
    );

    // Assert
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith();
  });

  it('raises error and replies with bad request when invalid orid in params', () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
      params: Record<string, string>;
      log: {
        debug: (arg: string) => void;
      };
    } = {
      parsedToken: undefined,
      headers: { token: 'testToken' },
      params: {
        orid: 'some-trashy-value',
      },
      log: {
        debug: jest.fn(),
      },
    };
    const reply: {
      status: () => void;
      header: (key: string, value: string) => void;
      send: (arg: unknown) => void;
    } = {
      status: jest.fn(),
      header: jest.fn(),
      send: jest.fn(),
    };
    const done = jest.fn();

    // Act
    validateRequestOridParam(
      request as FastifyRequest,
      reply as unknown as FastifyReply,
      done,
    );

    // Assert
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(new Error('Missing or malformed ORID'));
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.header).toHaveBeenCalledWith('content-type', 'text/plain');
    expect(reply.send).toHaveBeenCalledWith('Resource not understood');
  });
});
