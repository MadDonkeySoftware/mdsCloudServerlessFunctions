import { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../../index';
import { asFunction, Lifetime } from 'awilix';

describe('healthCheckController test', () => {
  let app: FastifyInstance;
  const logicMock = {
    healthChecks: jest.fn(),
  };

  function makeRequest(overrides: InjectOptions = {}) {
    return app.inject({
      ...({
        url: '/health',
        method: 'GET',
      } as InjectOptions),
      ...overrides,
    });
  }

  beforeAll(async () => {
    app = await buildApp(({ diContainer }) => {
      diContainer.register({
        logic: asFunction(() => logicMock, {
          lifetime: Lifetime.SCOPED,
        }),
      });
      return Promise.resolve();
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('returns OK', async () => {
    // Act
    const resp = await makeRequest();

    // Assert
    expect(resp.statusCode).toBe(200);
    expect(resp.json()).toEqual({
      serverStatus: 'OK',
    });
  });
});
