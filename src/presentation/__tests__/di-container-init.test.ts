import { diContainerInit } from '../di-container-init';
import { diContainer } from '@fastify/awilix';
import { FastifyInstance } from 'fastify';

describe('di-container-init', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('registers expected items', async () => {
    try {
      // Arrange
      const fakeServer = {
        log: {},
      } as unknown as FastifyInstance;
      await diContainerInit({ diContainer, server: fakeServer });

      // Act
      const logic = diContainer.resolve('logic');

      // Assert
      expect(logic).not.toBeNull();
    } finally {
      await diContainer.dispose();
    }
  });
});
