import * as jsonwebtoken from 'jsonwebtoken'; // skipcq: JS-C1003
import { Jwt } from 'jsonwebtoken';
import { validateToken } from '../validate-token';
import { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityJwt } from '../../types/identity-jwt';

jest.mock('jsonwebtoken');
const mockJsonwebtoken = jest.mocked(jsonwebtoken);

jest.mock('@maddonkeysoftware/mds-cloud-sdk-node', () => ({
  MdsSdk: {
    getIdentityServiceClient: jest.fn().mockResolvedValue({
      getPublicSignature: jest.fn().mockResolvedValue('fake-public-sig'),
    }),
  },
}));

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

describe('validate-token', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('for valid issuer set parsedToken on request', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
    } = {
      parsedToken: undefined,
      headers: { token: 'testToken' },
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
    const fakeToken: Partial<Jwt> = {
      payload: {
        iss: 'testIssuer',
      },
    };
    mockJsonwebtoken.verify.mockImplementation(() => fakeToken);

    // Act
    await validateToken(
      request as FastifyRequest,
      reply as unknown as FastifyReply,
    );

    // Assert
    expect(request.parsedToken).toBe(fakeToken);
  });

  it('Sends 403 response to caller for invalid issuer', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
      log: {
        debug: (arg: unknown) => void;
      };
    } = {
      parsedToken: undefined,
      headers: { token: 'testToken' },
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
    const fakeToken: Partial<Jwt> = {
      payload: {
        iss: 'bad-issuer',
      },
    };
    mockJsonwebtoken.verify.mockImplementation(() => fakeToken);

    // Act
    await expect(
      validateToken(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).rejects.toEqual(new Error('Invalid Authentication Token'));

    // Assert
    expect(request.parsedToken).toBeFalsy();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith();
  });

  it('Sends 403 response to caller when error occurs validating token', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
      log: {
        debug: (arg: unknown) => void;
      };
    } = {
      parsedToken: undefined,
      headers: { token: 'testToken' },
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
    mockJsonwebtoken.verify.mockImplementation(() => {
      throw new Error('test error');
    });

    // Act
    await expect(
      validateToken(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).rejects.toEqual(new Error('test error'));

    // Assert
    expect(request.parsedToken).toBeFalsy();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith();
  });

  it('Sends 403 response to caller when token missing in request', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
      log: {
        debug: (arg: unknown) => void;
      };
    } = {
      parsedToken: undefined,
      headers: {},
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

    // Act
    await expect(
      validateToken(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).rejects.toEqual(new Error('Missing Authentication Token'));

    // Assert
    expect(request.parsedToken).toBeFalsy();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.header).toHaveBeenCalledWith('content-type', 'text/plain');
    expect(reply.send).toHaveBeenCalledWith(
      'Please include authentication token in header "token"',
    );
  });
});
