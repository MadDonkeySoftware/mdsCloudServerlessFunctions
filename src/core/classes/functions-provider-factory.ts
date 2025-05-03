import { FunctionsProvider } from '../interfaces/functions-provider';
import { MissingFunctionsProviderError } from '../errors';
import { AuthManager } from '@maddonkeysoftware/mds-cloud-sdk-node/lib';
import type { ProviderConfiguration } from '../types/provider-configuration';
import { MdsCloudFunctionsProvider } from '../../infrastructure/repos/mds-cloud-functions-provider';
import { BaseLogger } from 'pino';

export class FunctionsProviderFactory {
  #mdsAuthManager: AuthManager;
  #logger: BaseLogger;
  #configuration: ProviderConfiguration;

  constructor({
    mdsAuthManager,
    logger,
    configuration,
  }: {
    mdsAuthManager: AuthManager;
    logger: BaseLogger;
    configuration: ProviderConfiguration;
  }) {
    this.#mdsAuthManager = mdsAuthManager;
    this.#logger = logger;
    this.#configuration = configuration;
  }

  getProviderForRuntime(runtime: string): FunctionsProvider {
    const providerKey = this.#configuration.runtimeMap[runtime];
    const providerConfig = this.#configuration.providers[providerKey];

    switch (providerConfig.type.toUpperCase()) {
      case 'MDSCLOUD':
        return new MdsCloudFunctionsProvider({
          mdsAuthManager: this.#mdsAuthManager,
          logger: this.#logger,
          configuration: providerConfig,
        });
      default:
        throw new MissingFunctionsProviderError(
          'No provider for runtime',
          runtime,
        );
    }
  }
}
