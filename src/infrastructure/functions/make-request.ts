import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseLogger } from 'pino';
import { defaultMakeRequestDelay } from './default-make-request-delay';
import { alwaysValidHttpStatusValidator } from './always-valid-http-status-validator';

export async function makeRequest({
  url,
  body,
  headers,
  httpVerb,
  attempt,
  maxAttempts,
  logger,
  delayFunc,
}: {
  url: string | URL;
  body?: any;
  headers?: Record<string, string>;
  httpVerb: string;
  attempt?: number;
  maxAttempts?: number;
  logger: BaseLogger;
  delayFunc?: (attempt: number) => Promise<void>;
}) {
  // TODO: incorporate cross-system request ids
  const internalAttempt = attempt ?? 1;
  const internalMaxAttempts = maxAttempts ?? 3;
  const internalDelayFunc = delayFunc ?? defaultMakeRequestDelay;

  logger.debug(
    {
      url,
      attempt: internalAttempt,
      maxAttempts: internalMaxAttempts,
    },
    'Attempting to make request',
  );

  const requestOptions: AxiosRequestConfig = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },

    // Always have a valid status so that way we can handle the retry ourselves.
    validateStatus: alwaysValidHttpStatusValidator,
  };

  let resp: AxiosResponse | undefined;
  let throwUnknownVerb = false;
  try {
    switch (httpVerb.toUpperCase()) {
      case 'GET':
        resp = await axios.get(url.toString(), requestOptions);
        break;
      case 'POST':
        resp = await axios.post(url.toString(), body, requestOptions);
        break;
      case 'DELETE':
        resp = await axios.delete(url.toString(), requestOptions);
        break;
      default:
        throwUnknownVerb = true;
    }
  } catch (err) {
    logger.warn(
      { err },
      'Error occurred when making request to function provider',
    );
  }

  if (throwUnknownVerb) {
    // TODO: Typed error
    throw new Error(`HTTP verb "${httpVerb}" not understood.`);
  }

  if (
    (resp === undefined || resp.status > 499) &&
    internalAttempt < internalMaxAttempts
  ) {
    logger.warn(
      { status: resp?.status },
      'Error encountered with request. Retrying after delay',
    );
    await internalDelayFunc(internalAttempt);
    return makeRequest({
      url,
      body,
      headers,
      httpVerb,
      attempt: internalAttempt + 1,
      maxAttempts: internalMaxAttempts,
      delayFunc,
      logger,
    });
  }

  return resp;
}
