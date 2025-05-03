import { buildApp } from '../index';
import { FastifyInstance } from 'fastify';

describe('presentation', () => {
  let app: FastifyInstance | undefined;

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  describe('buildApp', () => {
    it('using default DI creates and starts container manager', async () => {
      // Arrange
      app = await buildApp();

      // Assert
      expect(app).not.toBeUndefined();
    });
  });
});
