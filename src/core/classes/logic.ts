import { FunctionsRepo } from '../interfaces/functions-repo';
import { FunctionExistsError, FunctionNotFoundError } from '../errors';
import { FunctionsProviderFactory } from './functions-provider-factory';
import { FunctionInvokeResult } from '../interfaces/functions-provider';
import { BaseLogger } from 'pino';

export class Logic {
  #functionsRepo: FunctionsRepo;
  #functionsProviderFactory: FunctionsProviderFactory;
  #logger: BaseLogger;

  constructor({
    functionsRepo,
    functionsProviderFactory,
    logger,
  }: {
    functionsRepo: FunctionsRepo;
    functionsProviderFactory: FunctionsProviderFactory;
    logger: BaseLogger;
  }) {
    this.#functionsRepo = functionsRepo;
    this.#functionsProviderFactory = functionsProviderFactory;
    this.#logger = logger;
  }

  listFunctions(accountId?: string) {
    return this.#functionsRepo.listFunctions(accountId);
  }

  async createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }) {
    const existingFunction =
      await this.#functionsRepo.getFunctionByNameAndAccount({
        name,
        accountId,
      });
    if (existingFunction) {
      throw new FunctionExistsError(
        'Function already exists',
        existingFunction.id,
      );
    }
    return this.#functionsRepo.createFunction({ name, accountId });
  }

  async deleteFunction({ id, accountId }: { id: string; accountId: string }) {
    const functionData = await this.#functionsRepo.getFunctionByIdAndAccount({
      id,
      accountId,
    });

    if (!functionData) {
      throw new FunctionNotFoundError(`Function not found`, id);
    }

    if (functionData.providerFuncId && functionData.runtime) {
      // Remove downstream items
      const provider = this.#functionsProviderFactory.getProviderForRuntime(
        functionData.runtime,
      );

      await provider.deleteFunction({
        id: functionData.providerFuncId,
      });
    }

    await this.#functionsRepo.deleteFunction({ id, accountId });
  }

  async updateFunctionCode({
    id,
    accountId,
    codePackage,
    runtime,
    entryPoint,
    context,
  }: {
    id: string;
    accountId: string;
    codePackage: ReadableStream | string;
    runtime: string;
    entryPoint: string;
    context: string;
  }) {
    const functionData = await this.#functionsRepo.getFunctionByIdAndAccount({
      id,
      accountId,
    });

    if (!functionData) {
      throw new FunctionNotFoundError(`Function not found`, id);
    }

    // TODO: Need to handle provider switching between runtimes
    const provider =
      this.#functionsProviderFactory.getProviderForRuntime(runtime);

    let providerFuncId = functionData.providerFuncId;
    if (!providerFuncId) {
      providerFuncId = await provider.createFunction({
        name: functionData.name,
        accountId: functionData.accountId,
      });

      // TODO: throw domain specific error
      if (!providerFuncId) {
        throw new Error(`Failed to create function in provider`);
      }

      await this.#functionsRepo.updateFunctionInfo({
        id,
        payload: {
          providerFuncId,
          runtime,
          entryPoint,
        },
      });
    }

    const successful = await provider.updateFunction({
      id: providerFuncId,
      source: codePackage,
      runtime,
      entryPoint,
      context,
    });

    // TODO: Logging
    return successful;
  }

  async invokeFunction({
    id,
    accountId,
    payload,
    async,
  }: {
    id: string;
    accountId: string;
    payload: string;
    async?: boolean;
  }) {
    const functionData = await this.#functionsRepo.getFunctionByIdAndAccount({
      id,
      accountId,
    });

    if (!functionData) {
      throw new FunctionNotFoundError(`Function not found`, id);
    }

    if (!functionData.providerFuncId) {
      throw new Error(`Function has not been deployed`);
    }

    const provider = this.#functionsProviderFactory.getProviderForRuntime(
      functionData.runtime!,
    );

    let result: FunctionInvokeResult | undefined;
    if (async) {
      // NOTE: when invoking async, we don't wait for the result since the user does not expect it
      provider
        .invokeFunction({
          id: functionData.providerFuncId,
          payload,
        })
        .catch((err) => {
          this.#logger.warn(
            {
              functionData: {
                id: functionData.id,
                accountId: functionData.accountId,
                runtime: functionData.runtime,
                providerFuncId: functionData.providerFuncId,
              },
              err,
            },
            'Error invoking function in async mode.',
          );
        });
    } else {
      result = await provider.invokeFunction({
        id: functionData.providerFuncId!,
        payload,
      });
    }

    await this.#functionsRepo.updateFunctionInfo({
      id,
      payload: {
        lastInvoke: new Date().toISOString(),
      },
    });

    return result;
  }

  async getFunctionDetails({
    id,
    accountId,
  }: {
    id: string;
    accountId: string;
  }) {
    const functionData = await this.#functionsRepo.getFunctionByIdAndAccount({
      id,
      accountId,
    });

    return functionData;
  }
}
