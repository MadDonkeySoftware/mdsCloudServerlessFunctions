import { asFunction, Lifetime } from 'awilix';
import { FastifyInstance, InjectOptions } from 'fastify';
import formAutoContent from 'form-auto-content';
import { createReadStream } from 'fs';
import { buildApp } from '../../../index';
import { validateToken } from '../../../hooks/validate-token';
import { IdentityJwt } from '../../../types/identity-jwt';
import {
  FunctionExistsError,
  FunctionNotFoundError,
} from '../../../../core/errors';
import { join } from 'path';

jest.mock('../../../hooks/validate-token', () => {
  return {
    validateToken: jest.fn().mockImplementation((req, res, next) => {
      req.parsedToken = {
        payload: {
          accountId: 'testAccountId',
        },
      };
      next();
    }),
  };
});
const mockValidateToken = jest.mocked(validateToken);

describe('functions controller test', () => {
  let app: FastifyInstance;
  const logicMock = {
    listFunctions: jest.fn(),
    createFunction: jest.fn(),
    deleteFunction: jest.fn(),
    updateFunctionCode: jest.fn(),
    invokeFunction: jest.fn(),
    getFunctionDetails: jest.fn(),
  };
  const testFunctionOrid = 'orid:1:testIssuer:::testAccountId:sf:testFunc';

  function makeRequest(overrides: InjectOptions = {}) {
    return app.inject({
      ...({
        url: '/',
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('list functions', () => {
    it('when valid user request, responds with 200 and list of functions', async () => {
      // Arrange
      logicMock.listFunctions.mockResolvedValueOnce([
        {
          id: 'func1',
          name: 'Func 1',
          accountId: '1000',
        },
        {
          id: 'func2',
          name: 'Func 2',
          accountId: '1000',
        },
      ]);

      // Act
      const response = await makeRequest({
        url: '/v1/list',
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(JSON.parse(response.body)).toEqual([
        {
          name: 'Func 1',
          orid: 'orid:1:testIssuer:::1000:sf:func1',
        },
        {
          name: 'Func 2',
          orid: 'orid:1:testIssuer:::1000:sf:func2',
        },
      ]);
      expect(logicMock.listFunctions).toHaveBeenCalledWith('testAccountId');
      expect(response.statusCode).toBe(200);
    });

    it('when valid system request, responds with 200 and list of all functions', async () => {
      // Arrange
      logicMock.listFunctions.mockResolvedValueOnce([
        {
          id: 'func1',
          name: 'Func 1',
          accountId: '1000',
        },
        {
          id: 'func1',
          name: 'Func 1',
          accountId: '1001',
        },
      ]);
      mockValidateToken.mockImplementationOnce((req) => {
        req.parsedToken = {
          payload: {
            accountId: '1',
          },
        } as IdentityJwt;
        return Promise.resolve();
      });

      // Act
      const response = await makeRequest({
        url: '/v1/list',
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(JSON.parse(response.body)).toEqual([
        {
          name: 'Func 1',
          orid: 'orid:1:testIssuer:::1000:sf:func1',
        },
        {
          name: 'Func 1',
          orid: 'orid:1:testIssuer:::1001:sf:func1',
        },
      ]);
      expect(logicMock.listFunctions).toHaveBeenCalledWith();
      expect(response.statusCode).toBe(200);
    });
  });

  describe('create function', () => {
    it('when valid request, responds with 201 and created details', async () => {
      // Arrange
      logicMock.createFunction.mockResolvedValueOnce('newTestId');

      // Act
      const response = await makeRequest({
        url: '/v1/create',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testFunc',
        },
      });

      // Assert
      expect(logicMock.createFunction).toHaveBeenCalledWith({
        name: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: 'orid:1:testIssuer:::testAccountId:sf:newTestId',
        name: 'testFunc',
      });
      expect(response.statusCode).toBe(201);
    });

    it('when valid request and existing function, responds with 409 and details', async () => {
      // Arrange
      logicMock.createFunction.mockRejectedValueOnce(
        new FunctionExistsError('functions controller test error', 'newTestId'),
      );

      // Act
      const response = await makeRequest({
        url: '/v1/create',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testFunc',
        },
      });

      // Assert
      expect(logicMock.createFunction).toHaveBeenCalledWith({
        name: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: 'orid:1:testIssuer:::testAccountId:sf:newTestId',
      });
      expect(response.statusCode).toBe(409);
    });

    it('when valid request and unknown error, responds with 500 and details', async () => {
      // Arrange
      logicMock.createFunction.mockRejectedValueOnce(
        new Error('functions controller test error'),
      );

      // Act
      const response = await makeRequest({
        url: '/v1/create',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testFunc',
        },
      });

      // Assert
      expect(logicMock.createFunction).toHaveBeenCalledWith({
        name: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'functions controller test error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('delete function', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.deleteFunction.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/${testFunctionOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.deleteFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(response.body).toBe('');
      expect(response.statusCode).toBe(204);
    });

    it('when function not found, responds with 404', async () => {
      // Arrange
      logicMock.deleteFunction.mockRejectedValueOnce(
        new FunctionNotFoundError(
          'functions controller test error',
          'testFunc',
        ),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/${testFunctionOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.deleteFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(response.statusCode).toBe(404);
    });

    it('when unknown error, responds with 500', async () => {
      // Arrange
      logicMock.deleteFunction.mockRejectedValueOnce(
        new Error('functions controller test error'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/${testFunctionOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.deleteFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'functions controller test error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('update function code', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.updateFunctionCode.mockResolvedValueOnce(true);
      const formData = formAutoContent({
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
        sourceArchive: createReadStream(
          join(__dirname, 'data', 'mdsCloudServerlessFunctions-sampleApp.zip'),
        ),
      });

      // Act
      const response = await makeRequest({
        url: `/v1/uploadCode/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          ...formData.headers,
          token: 'testToken',
        },
        payload: formData.payload,
      });

      // Assert
      expect(logicMock.updateFunctionCode).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        codePackage: expect.stringMatching(/\/tmp\/.*/),
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
      });
      expect(JSON.parse(response.body)).toEqual({
        id: 'testFunc',
        orid: 'orid:1:testIssuer:::testAccountId:sf:testFunc',
        status: 'buildComplete',
      });
      expect(response.statusCode).toBe(201);
    });

    it('when valid request but build failed, responds with 400', async () => {
      // Arrange
      logicMock.updateFunctionCode.mockResolvedValueOnce(false);
      const formData = formAutoContent({
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
        sourceArchive: createReadStream(
          join(__dirname, 'data', 'mdsCloudServerlessFunctions-sampleApp.zip'),
        ),
      });

      // Act
      const response = await makeRequest({
        url: `/v1/uploadCode/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          ...formData.headers,
          token: 'testToken',
        },
        payload: formData.payload,
      });

      // Assert
      expect(logicMock.updateFunctionCode).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        codePackage: expect.stringMatching(/\/tmp\/.*/),
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
      });
      expect(JSON.parse(response.body)).toEqual({
        id: 'testFunc',
        orid: 'orid:1:testIssuer:::testAccountId:sf:testFunc',
        status: 'buildFailed',
      });
      expect(response.statusCode).toBe(400);
    });

    it('when request missing required attributes, responds with 400', async () => {
      // Arrange
      const formData = formAutoContent({
        sourceArchive: createReadStream(
          join(__dirname, 'data', 'mdsCloudServerlessFunctions-sampleApp.zip'),
        ),
      });

      // Act
      const response = await makeRequest({
        url: `/v1/uploadCode/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          ...formData.headers,
          token: 'testToken',
        },
        payload: formData.payload,
      });

      // Assert
      expect(logicMock.updateFunctionCode).not.toHaveBeenCalled();
      expect(JSON.parse(response.body)).toEqual([
        {
          message: 'runtime missing from payload',
        },
        {
          message: 'entryPoint missing from payload',
        },
      ]);
      expect(response.statusCode).toBe(400);
    });

    it('when unknown error, responds with 500', async () => {
      // Arrange
      logicMock.updateFunctionCode.mockRejectedValueOnce(
        new Error('functions controller test error'),
      );
      const formData = formAutoContent({
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
        sourceArchive: createReadStream(
          join(__dirname, 'data', 'mdsCloudServerlessFunctions-sampleApp.zip'),
        ),
      });

      // Act
      const response = await makeRequest({
        url: `/v1/uploadCode/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          ...formData.headers,
          token: 'testToken',
        },
        payload: formData.payload,
      });

      // Assert
      expect(logicMock.updateFunctionCode).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        codePackage: expect.stringMatching(/\/tmp\/.*/),
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'functions controller test error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('invoke function', () => {
    it('when valid synchronous request, responds with 200 and function response', async () => {
      // Arrange
      const testPayload = { test: 'payload' };
      const testResponse = { status: 200, data: { test: 'response' } };
      logicMock.invokeFunction.mockResolvedValueOnce(testResponse);

      // Act
      const response = await makeRequest({
        url: `/v1/invoke/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: testPayload,
      });

      // Assert
      expect(logicMock.invokeFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        async: undefined,
        payload: testPayload,
      });
      expect(JSON.parse(response.body)).toEqual(testResponse.data);
      expect(response.statusCode).toBe(testResponse.status);
    });

    it('when valid asynchronous request, responds with 202', async () => {
      // Arrange
      const testPayload = { test: 'payload' };
      logicMock.invokeFunction.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/invoke/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: testPayload,
      });

      // Assert
      expect(logicMock.invokeFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        async: undefined,
        payload: testPayload,
      });
      expect(JSON.parse(response.body)).toEqual({
        message: 'Request accepted.',
      });
      expect(response.statusCode).toBe(202);
    });

    it('when valid request but function throws error, responds with 500', async () => {
      // Arrange
      const testPayload = { test: 'payload' };
      logicMock.invokeFunction.mockRejectedValueOnce(
        new Error('functions controller test error'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/invoke/${testFunctionOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: testPayload,
      });

      // Assert
      expect(logicMock.invokeFunction).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
        async: undefined,
        payload: testPayload,
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'functions controller test error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('inspect function', () => {
    it('when valid request, responds with 200 and function details', async () => {
      // Arrange
      const now = new Date();
      logicMock.getFunctionDetails.mockResolvedValueOnce({
        name: 'testFunc',
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        context: 'testContext',
        created: now.toISOString(),
      });

      // Act
      const response = await makeRequest({
        url: `/v1/inspect/${testFunctionOrid}`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getFunctionDetails).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        id: 'testFunc',
        orid: 'orid:1:testIssuer:::testAccountId:sf:testFunc',
        name: 'testFunc',
        runtime: 'testRuntime',
        entryPoint: 'testEntryPoint',
        created: now.toISOString(),
      });
      expect(response.statusCode).toBe(200);
    });

    it('when function not found, responds with 404', async () => {
      // Arrange
      logicMock.getFunctionDetails.mockResolvedValueOnce(null);

      // Act
      const response = await makeRequest({
        url: `/v1/inspect/${testFunctionOrid}`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getFunctionDetails).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(response.statusCode).toBe(404);
    });

    it('when unknown error, responds with 500', async () => {
      // Arrange
      logicMock.getFunctionDetails.mockRejectedValueOnce(
        new Error('functions controller test error'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/inspect/${testFunctionOrid}`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getFunctionDetails).toHaveBeenCalledWith({
        id: 'testFunc',
        accountId: 'testAccountId',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'functions controller test error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });
});
