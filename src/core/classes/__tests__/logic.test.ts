import { Logic } from '../logic';
import { FunctionsRepo } from '../../interfaces/functions-repo';
import { FunctionsProviderFactory } from '../functions-provider-factory';
import { BaseLogger } from 'pino';

describe('Logic', () => {
  let logic: Logic;
  const fakeFunctionsRepo = {
    listFunctions: jest.fn(),
    createFunction: jest.fn(),
    getFunctionByNameAndAccount: jest.fn(),
    getFunctionByIdAndAccount: jest.fn(),
    deleteFunction: jest.fn(),
    updateFunctionInfo: jest.fn(),
  };
  const fakeFunctionsProviderFactory = {
    getProviderForRuntime: jest.fn(),
  };
  const fakeLogger = {
    warn: jest.fn(),
  };

  beforeAll(() => {
    logic = new Logic({
      functionsRepo: fakeFunctionsRepo as unknown as FunctionsRepo,
      functionsProviderFactory:
        fakeFunctionsProviderFactory as unknown as FunctionsProviderFactory,
      logger: fakeLogger as unknown as BaseLogger,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('listFunctions', () => {
    it('should return results from underlying repository', async () => {
      // Arrange
      const accountId = '1';
      const expected = [{ id: '1', name: 'foo', accountId: '1' }];
      fakeFunctionsRepo.listFunctions.mockResolvedValue(expected);

      // Act
      const result = await logic.listFunctions(accountId);

      // Assert
      expect(result).toEqual(expected);
      expect(fakeFunctionsRepo.listFunctions).toHaveBeenCalledWith(accountId);
    });
  });

  describe('createFunction', () => {
    it('should throw an error if the function already exists', async () => {
      // Arrange
      const name = 'foo';
      const accountId = '1';
      const existingFunction = { id: '1', name, accountId };
      fakeFunctionsRepo.getFunctionByNameAndAccount.mockResolvedValue(
        existingFunction,
      );

      // Act
      const result = logic.createFunction({ name, accountId });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Function already exists"`,
      );
      expect(
        fakeFunctionsRepo.getFunctionByNameAndAccount,
      ).toHaveBeenCalledWith({ name, accountId });
      expect(fakeFunctionsRepo.createFunction).not.toHaveBeenCalled();
    });

    it('should create a function if it does not already exist', async () => {
      // Arrange
      const name = 'foo';
      const accountId = '1';
      fakeFunctionsRepo.getFunctionByNameAndAccount.mockResolvedValue(null);
      fakeFunctionsRepo.createFunction.mockResolvedValue('1');

      // Act
      const result = await logic.createFunction({ name, accountId });

      // Assert
      expect(result).toEqual('1');
      expect(
        fakeFunctionsRepo.getFunctionByNameAndAccount,
      ).toHaveBeenCalledWith({ name, accountId });
      expect(fakeFunctionsRepo.createFunction).toHaveBeenCalledWith({
        name,
        accountId,
      });
    });
  });

  describe('deleteFunction', () => {
    it('should throw an error if the function does not exist', async () => {
      // Arrange
      const id = '1';
      const accountId = 'accountId';
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(null);

      // Act
      const result = logic.deleteFunction({ id, accountId });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Function not found"`,
      );
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(fakeFunctionsRepo.createFunction).not.toHaveBeenCalled();
    });

    it('should delete a function if it exists only locally', async () => {
      // Arrange
      const id = '1';
      const accountId = 'accountId';
      const existingFunction = { id, accountId };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        existingFunction,
      );

      // Act
      await logic.deleteFunction({ id, accountId });

      // Assert
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
    });

    it('should delete a function if it exists locally and remotely', async () => {
      // Arrange
      const id = '1';
      const accountId = 'accountId';
      const existingFunction = {
        id,
        accountId,
        providerFuncId: 'providerId',
        runtime: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        existingFunction,
      );
      const fakeProvider = {
        deleteFunction: jest.fn(),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      await logic.deleteFunction({ id, accountId });

      // Assert
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith(existingFunction.runtime);
      expect(fakeProvider.deleteFunction).toHaveBeenCalledWith({
        id: existingFunction.providerFuncId,
      });
    });
  });

  describe('updateFunctionCode', () => {
    it('should throw an error if the function does not exist', async () => {
      // Arrange
      const id = '1';
      const accountId = 'accountId';
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(null);

      // Act
      const result = logic.updateFunctionCode({
        id,
        accountId,
        codePackage: 'test',
        runtime: 'test',
        entryPoint: 'test',
        context: '',
      });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Function not found"`,
      );
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(fakeFunctionsRepo.createFunction).not.toHaveBeenCalled();
    });

    it('should update a function if it exists only locally', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        createFunction: jest.fn().mockResolvedValue('providerId'),
        updateFunction: jest.fn(),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      await logic.updateFunctionCode({
        id,
        accountId,
        codePackage: 'code',
        runtime: 'runtime',
        entryPoint: 'entryPoint',
        context: '',
      });

      // Assert
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('runtime');
      expect(fakeProvider.createFunction).toHaveBeenCalledWith({
        name: systemFunctionData.name,
        accountId,
      });
      expect(fakeProvider.updateFunction).toHaveBeenCalledWith({
        id: 'providerId',
        source: 'code',
        runtime: 'runtime',
        entryPoint: 'entryPoint',
        context: '',
      });
      expect(fakeFunctionsRepo.updateFunctionInfo).toHaveBeenCalledWith({
        id,
        payload: {
          entryPoint: 'entryPoint',
          providerFuncId: 'providerId',
          runtime: 'runtime',
        },
      });
    });

    it('should update a function if it exists locally and remotely', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
        providerFuncId: 'providerId',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        updateFunction: jest.fn(),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      await logic.updateFunctionCode({
        id,
        accountId,
        codePackage: 'code',
        runtime: 'runtime',
        entryPoint: 'entryPoint',
        context: '',
      });

      // Assert
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('runtime');
      expect(fakeProvider.updateFunction).toHaveBeenCalledWith({
        id: 'providerId',
        source: 'code',
        runtime: 'runtime',
        entryPoint: 'entryPoint',
        context: '',
      });
      expect(fakeFunctionsRepo.updateFunctionInfo).not.toHaveBeenCalled();
    });

    it('should throw an error if the function create at provider fails', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        createFunction: jest.fn().mockResolvedValue(undefined),
        updateFunction: jest.fn(),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      const result = logic.updateFunctionCode({
        id,
        accountId,
        codePackage: 'code',
        runtime: 'runtime',
        entryPoint: 'entryPoint',
        context: '',
      });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Failed to create function in provider"`,
      );
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('runtime');
      expect(fakeProvider.createFunction).toHaveBeenCalledWith({
        name: systemFunctionData.name,
        accountId,
      });
      expect(fakeProvider.updateFunction).not.toHaveBeenCalled();
      expect(fakeFunctionsRepo.updateFunctionInfo).not.toHaveBeenCalled();
    });
  });

  describe('invokeFunction', () => {
    it('should throw an error if the function does not exist', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(null);

      // Act
      const result = logic.invokeFunction({
        id,
        accountId,
        payload: 'test',
      });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Function not found"`,
      );
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(fakeFunctionsRepo.createFunction).not.toHaveBeenCalled();
    });

    it('should throw an error if the function has not been deployed', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const existingFunction = { id, accountId };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        existingFunction,
      );

      // Act
      const result = logic.invokeFunction({
        id,
        accountId,
        payload: 'test',
      });

      // Assert
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Function has not been deployed"`,
      );
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(fakeFunctionsRepo.createFunction).not.toHaveBeenCalled();
    });

    it('should invoke a function synchronously and return the result', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
        providerFuncId: 'providerId',
        runtime: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        invokeFunction: jest.fn().mockResolvedValue({
          status: 200,
          data: 'test',
        }),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      const result = await logic.invokeFunction({
        id,
        accountId,
        payload: 'test',
      });

      // Assert
      expect(result).toEqual({
        status: 200,
        data: 'test',
      });
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('test');
      expect(fakeProvider.invokeFunction).toHaveBeenCalledWith({
        id: 'providerId',
        payload: 'test',
      });
    });

    it('should invoke a function asynchronously', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
        providerFuncId: 'providerId',
        runtime: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        invokeFunction: jest.fn().mockResolvedValue({
          status: 200,
          data: 'test',
        }),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      const result = await logic.invokeFunction({
        id,
        accountId,
        payload: 'test',
        async: true,
      });

      // Assert
      expect(result).toBe(undefined);
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('test');
      expect(fakeProvider.invokeFunction).toHaveBeenCalledWith({
        id: 'providerId',
        payload: 'test',
      });
    });

    it('should throw an error if the function invocation fails', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
        providerFuncId: 'providerId',
        runtime: 'test',
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );
      const fakeProvider = {
        invokeFunction: jest.fn().mockRejectedValue(new Error('test error')),
      };
      fakeFunctionsProviderFactory.getProviderForRuntime.mockReturnValue(
        fakeProvider,
      );

      // Act
      const result = await logic.invokeFunction({
        id,
        accountId,
        payload: 'test',
        async: true,
      });

      // Assert
      expect(result).toBe(undefined);
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
      expect(
        fakeFunctionsProviderFactory.getProviderForRuntime,
      ).toHaveBeenCalledWith('test');
      expect(fakeProvider.invokeFunction).toHaveBeenCalledWith({
        id: 'providerId',
        payload: 'test',
      });
      expect(fakeLogger.warn).toHaveBeenCalledWith(
        {
          err: expect.any(Error),
          functionData: {
            id: systemFunctionData.id,
            accountId: systemFunctionData.accountId,
            runtime: systemFunctionData.runtime,
            providerFuncId: systemFunctionData.providerFuncId,
          },
        },
        'Error invoking function in async mode.',
      );
    });
  });
  describe('getFunctionDetails', () => {
    it('should return null if the function does not exist', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(null);

      // Act
      const result = await logic.getFunctionDetails({
        id,
        accountId,
      });

      // Assert
      expect(result).toBe(null);
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
    });

    it('should return the function details if the function exists', async () => {
      // Arrange
      const id = '1';
      const accountId = 'account';
      const systemFunctionData = {
        id,
        accountId,
        name: 'test',
        providerFuncId: 'providerId',
        runtime: 'test',
        entryPoint: 'test',
        created: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        lastInvoke: new Date().toISOString(),
      };
      fakeFunctionsRepo.getFunctionByIdAndAccount.mockResolvedValue(
        systemFunctionData,
      );

      // Act
      const result = await logic.getFunctionDetails({
        id,
        accountId,
      });

      // Assert
      expect(result).toEqual({
        id,
        accountId,
        name: systemFunctionData.name,
        providerFuncId: systemFunctionData.providerFuncId,
        runtime: systemFunctionData.runtime,
        entryPoint: systemFunctionData.entryPoint,
        created: systemFunctionData.created,
        lastUpdate: systemFunctionData.lastUpdate,
        lastInvoke: systemFunctionData.lastInvoke,
      });
      expect(fakeFunctionsRepo.getFunctionByIdAndAccount).toHaveBeenCalledWith({
        id,
        accountId,
      });
    });
  });
});
