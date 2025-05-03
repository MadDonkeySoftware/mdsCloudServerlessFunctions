import { FunctionsProviderFactory } from '../functions-provider-factory';
import { MdsCloudFunctionsProvider } from '../../../infrastructure/repos/mds-cloud-functions-provider';

describe('FunctionsProviderFactory', () => {
  let providerFactory: FunctionsProviderFactory;

  beforeAll(() => {
    providerFactory = new FunctionsProviderFactory({
      mdsAuthManager: {} as any,
      logger: {} as any,
      configuration: {
        version: '1',
        runtimeMap: {
          known: 'known',
          unknown: 'unknown',
        },
        providers: {
          known: {
            type: 'mdscloud',
            baseUrl: 'http://example.com',
          },
          unknown: {
            type: 'unknown',
          },
        },
      },
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('getProviderForRuntime', () => {
    it('should return a provider for a known runtime', () => {
      // Arrange
      const runtime = 'known';

      // Act
      const result = providerFactory.getProviderForRuntime(runtime);

      // Assert
      expect(result).toBeDefined();
      expect(result instanceof MdsCloudFunctionsProvider).toBeTruthy();
    });

    it('should throw an error for an unknown runtime', () => {
      // Arrange
      const runtime = 'unknown';

      // Act
      const result = () => providerFactory.getProviderForRuntime(runtime);

      // Assert
      expect(result).toThrowErrorMatchingInlineSnapshot(
        `"No provider for runtime"`,
      );
    });
  });
});
