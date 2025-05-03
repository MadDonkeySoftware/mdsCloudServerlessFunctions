import {
  FunctionInvokeResult,
  FunctionsProvider,
} from '../../core/interfaces/functions-provider';
import { BaseLogger } from 'pino';
import buildUrl from 'build-url';
import FormData from 'form-data';
import { createReadStream } from 'fs';

import { AuthManager } from '@maddonkeysoftware/mds-cloud-sdk-node/lib';
import { makeRequest } from '../functions/make-request';
import { Provider } from '../../core/types/provider-configuration';

export class MdsCloudFunctionsProvider implements FunctionsProvider {
  #authManager: AuthManager;
  #logger: BaseLogger;
  #baseUrl: string;

  constructor({
    mdsAuthManager,
    logger,
    configuration,
  }: {
    mdsAuthManager: AuthManager;
    logger: BaseLogger;
    configuration: Provider;
  }) {
    this.#authManager = mdsAuthManager;
    this.#logger = logger;
    this.#baseUrl = configuration.baseUrl;

    if (!this.#baseUrl) {
      throw new Error('Missing baseUrl from provider configuration');
    }
  }

  async createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<string | undefined> {
    const token = await this.#authManager.getAuthenticationToken();
    const headers = {
      token,
    };
    const url = buildUrl(this.#baseUrl, { path: '/v1/createFunction' });
    const response = await makeRequest({
      logger: this.#logger,
      url,
      httpVerb: 'POST',
      headers,
      body: {
        name,
        accountId,
      },
    });

    if (response!.status === 201) {
      return response!.data.id;
    }

    this.#logger.warn(
      { status: response!.status, response: response!.data },
      'Failed to create function',
    );
    return undefined;
  }

  async deleteFunction({ id }: { id: string }): Promise<boolean> {
    const token = await this.#authManager.getAuthenticationToken();
    const url = buildUrl(this.#baseUrl, { path: `/v1/${id}` });
    const response = await makeRequest({
      url,
      httpVerb: 'DELETE',
      headers: {
        token,
      },
      logger: this.#logger,
    });

    if (response!.status === 204 || response!.status === 200) {
      return true;
    }

    this.#logger.warn(
      {
        functionId: id,
        status: response!.status,
        response: response!.data,
      },
      'Failed to delete function',
    );
    return false;
  }

  async invokeFunction({
    id,
    payload,
  }: {
    id: string;
    payload: string;
  }): Promise<FunctionInvokeResult | undefined> {
    const token = await this.#authManager.getAuthenticationToken();
    const url = buildUrl(this.#baseUrl, { path: `/v1/executeFunction/${id}` });
    const response = await makeRequest({
      logger: this.#logger,
      url,
      httpVerb: 'POST',
      headers: { token },
      body: payload,
    });

    if (response!.status === 200) {
      return {
        status: response!.status,
        data: response!.data,
      };
    }

    this.#logger.warn(
      { status: response!.status, response: response!.data },
      'Failed to invoke function',
    );
    return undefined;
  }

  async updateFunction({
    id,
    source,
    runtime,
    entryPoint,
    context,
  }: {
    id: string;
    source: string | ReadableStream;
    runtime: string;
    entryPoint: string;
    context?: string;
  }): Promise<boolean> {
    const form = new FormData();
    form.append('functionId', id);
    form.append('runtime', runtime);
    form.append('entryPoint', entryPoint);
    if (context) {
      form.append('context', context);
    }
    form.append(
      'sourceArchive',
      typeof source === 'string' ? createReadStream(source) : source,
    );

    const token = await this.#authManager.getAuthenticationToken();
    const headers = {
      ...form.getHeaders(),
      token,
    };

    const url = buildUrl(this.#baseUrl, { path: '/v1/buildFunction' });
    const response = await makeRequest({
      logger: this.#logger,
      url,
      httpVerb: 'POST',
      headers,
      body: form,
    });

    if (response!.status === 200) {
      return true;
    }

    this.#logger.warn(
      { status: response!.status, response: response!.data },
      'Failed to update function',
    );
    return false;
  }
}
