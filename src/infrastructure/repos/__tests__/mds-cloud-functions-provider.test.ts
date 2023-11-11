import { MdsCloudFunctionsProvider } from '../mds-cloud-functions-provider';
import { makeRequest } from '../../functions/make-request';

jest.mock('../../functions/make-request', () => ({
  makeRequest: jest.fn(),
}));
const makeRequestMock = makeRequest as jest.Mock;

jest.mock('fs', () => ({
  createReadStream: jest.fn().mockReturnValue({
    name: 'test-value',
    on: jest.fn(),
    pause: jest.fn(),
  }),
}));

describe('updateFunctionInfo', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  function createProvider() {
    const mockAuthManager = {
      getAuthenticationToken: jest.fn().mockResolvedValue('token'),
    };
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    const mockConfiguration = {
      baseUrl: 'http://test',
    };

    const provider = new MdsCloudFunctionsProvider({
      mdsAuthManager: mockAuthManager as any,
      logger: mockLogger as any,
      configuration: mockConfiguration as any,
    });
    return { provider, mockAuthManager, mockLogger };
  }

  describe('constructor', () => {
    it('when missing baseUrl, throws error', () => {
      // Arrange
      const mockAuthManager = {
        getAuthenticationToken: jest.fn().mockResolvedValue('token'),
      };
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
      };
      const mockConfiguration = {
        baseUrl: undefined,
      };

      // Act
      const result = () =>
        new MdsCloudFunctionsProvider({
          mdsAuthManager: mockAuthManager as any,
          logger: mockLogger as any,
          configuration: mockConfiguration as any,
        });

      // Assert
      expect(result).toThrow('Missing baseUrl from provider configuration');
    });
  });

  describe('createFunction', () => {
    function getCreateMakeRequestArgs(mockLogger: any) {
      return {
        logger: mockLogger,
        url: 'http://test/v1/createFunction',
        httpVerb: 'POST',
        headers: {
          token: 'token',
        },
        body: {
          name: 'test',
          accountId: '1',
        },
      };
    }

    it('when successful, returns id', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 201,
        data: {
          id: '1',
        },
      });

      // Act
      const result = await provider.createFunction({
        name: 'test',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual('1');
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getCreateMakeRequestArgs(mockLogger),
      );
    });

    it('when unsuccessful, returns undefined', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 409,
        data: {
          id: '1',
        },
      });

      // Act
      const result = await provider.createFunction({
        name: 'test',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(undefined);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getCreateMakeRequestArgs(mockLogger),
      );
    });
  });

  describe('deleteFunction', () => {
    function getDeleteMakeRequestArgs(mockLogger: any, id: string) {
      return {
        logger: mockLogger,
        url: `http://test/v1/${id}`,
        httpVerb: 'DELETE',
        headers: {
          token: 'token',
        },
      };
    }

    it('when successful, returns true', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 204,
      });

      // Act
      const result = await provider.deleteFunction({
        id: '1',
      });

      // Assert
      expect(result).toEqual(true);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getDeleteMakeRequestArgs(mockLogger, '1'),
      );
    });

    it('when unsuccessful, returns false', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 404,
      });

      // Act
      const result = await provider.deleteFunction({
        id: '1',
      });

      // Assert
      expect(result).toEqual(false);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getDeleteMakeRequestArgs(mockLogger, '1'),
      );
    });
  });

  describe('invokeFunction', () => {
    function getInvokeMakeRequestArgs(mockLogger: any, id: string, body: any) {
      return {
        logger: mockLogger,
        url: `http://test/v1/executeFunction/${id}`,
        httpVerb: 'POST',
        body,
        headers: {
          token: 'token',
        },
      };
    }

    it('when successful, returns result', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 200,
        data: {
          test: 'data',
        },
      });

      // Act
      const result = await provider.invokeFunction({
        id: '1',
        payload: 'test-payload',
      });

      // Assert
      expect(result).toEqual({
        status: 200,
        data: {
          test: 'data',
        },
      });
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getInvokeMakeRequestArgs(mockLogger, '1', 'test-payload'),
      );
    });

    it('when unsuccessful, returns undefined', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 404,
      });

      // Act
      const result = await provider.invokeFunction({
        id: '1',
        payload: 'test-payload',
      });

      // Assert
      expect(result).toEqual(undefined);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getInvokeMakeRequestArgs(mockLogger, '1', 'test-payload'),
      );
    });
  });

  describe('updateFunction', () => {
    function getUpdateMakeRequestArgs(mockLogger: any) {
      return {
        logger: mockLogger,
        url: `http://test/v1/buildFunction`,
        httpVerb: 'POST',
        // TODO: Figure out a good way to unit test that the body is being created correctly.
        // body: expect.any(FormData),
        body: expect.anything(),
        headers: {
          token: 'token',
          'content-type': expect.stringMatching(
            /multipart\/form-data; boundary=.*/,
          ),
        },
      };
    }

    it('when successful with string source, returns true', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 200,
      });

      // Act
      const result = await provider.updateFunction({
        id: '1',
        source: 'test-source',
        runtime: 'test-runtime',
        entryPoint: 'test-entry-point',
      });

      // Assert
      expect(result).toEqual(true);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getUpdateMakeRequestArgs(mockLogger),
      );
    });

    it('when unsuccessful, returns false', async () => {
      // Arrange
      const { provider, mockAuthManager, mockLogger } = createProvider();
      makeRequestMock.mockResolvedValue({
        status: 404,
      });

      // Act
      const result = await provider.updateFunction({
        id: '1',
        source: 'test-source',
        runtime: 'test-runtime',
        entryPoint: 'test-entry-point',
        context: 'some-context',
      });

      // Assert
      expect(result).toEqual(false);
      expect(mockAuthManager.getAuthenticationToken).toHaveBeenCalled();
      expect(makeRequestMock).toHaveBeenCalledWith(
        getUpdateMakeRequestArgs(mockLogger),
      );
    });
  });
});
