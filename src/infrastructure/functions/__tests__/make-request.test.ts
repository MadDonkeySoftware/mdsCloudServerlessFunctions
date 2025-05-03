import axios from 'axios';
import { BaseLogger } from 'pino';
import { makeRequest } from '../make-request';

describe('make-request', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('makeRequest', () => {
    it('should make a successful POST request properly', async () => {
      // Arrange
      const url = 'http://example.com';
      const body = { foo: 'bar' };
      const headers = { 'x-foo': 'bar' };
      const httpVerb = 'POST';
      const attempt = 1;
      const maxAttempts = 3;
      const logger = {
        debug: jest.fn(),
      };
      const delayFunc = jest.fn();
      const axiosMock = jest.spyOn(axios, 'post').mockResolvedValue({
        status: 200,
        data: { foo: 'bar' },
      });

      // Act
      const result = await makeRequest({
        url,
        body,
        headers,
        httpVerb,
        attempt,
        maxAttempts,
        logger: logger as unknown as BaseLogger,
        delayFunc,
      });

      // Assert
      expect(result).toEqual({
        status: 200,
        data: { foo: 'bar' },
      });
      expect(axiosMock).toHaveBeenCalledWith(url, body, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...headers,
        },
        validateStatus: expect.any(Function),
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          url,
          attempt,
          maxAttempts,
        },
        'Attempting to make request',
      );
      expect(delayFunc).not.toHaveBeenCalled();
    });

    it('should make a successful GET request properly', async () => {
      // Arrange
      const url = 'http://example.com';
      const httpVerb = 'GET';
      const logger = {
        debug: jest.fn(),
      };
      const axiosMock = jest.spyOn(axios, 'get').mockResolvedValue({
        status: 200,
        data: { foo: 'bar' },
      });

      // Act
      const result = await makeRequest({
        url,
        httpVerb,
        logger: logger as unknown as BaseLogger,
      });

      // Assert
      expect(result).toEqual({
        status: 200,
        data: { foo: 'bar' },
      });
      expect(axiosMock).toHaveBeenCalledWith(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: expect.any(Function),
      });
    });

    it('should make a successful DELETE request properly', async () => {
      // Arrange
      const url = 'http://example.com';
      const httpVerb = 'DELETE';
      const logger = {
        debug: jest.fn(),
      };
      const axiosMock = jest.spyOn(axios, 'delete').mockResolvedValue({
        status: 200,
        data: { foo: 'bar' },
      });

      // Act
      const result = await makeRequest({
        url,
        httpVerb,
        logger: logger as unknown as BaseLogger,
      });

      // Assert
      expect(result).toEqual({
        status: 200,

        data: { foo: 'bar' },
      });
      expect(axiosMock).toHaveBeenCalledWith(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: expect.any(Function),
      });
    });

    it('should retry when external server responds with 500 status', async () => {
      // Arrange
      const url = 'http://example.com';
      const body = { foo: 'bar' };
      const httpVerb = 'POST';
      const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
      };
      const delayFunc = jest.fn().mockResolvedValue(undefined);
      const axiosMock = jest
        .spyOn(axios, 'post')
        .mockResolvedValueOnce({
          status: 500,
          data: { foo: 'bar' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { foo: 'bar' },
        });

      // Act
      const result = await makeRequest({
        url,
        body,
        httpVerb,
        logger: logger as unknown as BaseLogger,
        delayFunc,
      });

      // Assert
      expect(result).toEqual({
        status: 200,
        data: { foo: 'bar' },
      });
      expect(axiosMock).toHaveBeenCalledTimes(2);
      expect(axiosMock).toHaveBeenCalledWith(url, body, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: expect.any(Function),
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          url,
          attempt: 1,
          maxAttempts: 3,
        },
        'Attempting to make request',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        {
          url,
          attempt: 2,
          maxAttempts: 3,
        },
        'Attempting to make request',
      );
      expect(delayFunc).toHaveBeenCalledTimes(1);
    });

    it('throw an error when the http verb is not understood', async () => {
      // Arrange
      const url = 'http://example.com';
      const httpVerb = 'FOO';
      const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
      };

      // Act
      const result = makeRequest({
        url,
        httpVerb,
        logger: logger as unknown as BaseLogger,
      });

      // Assert
      await expect(result).rejects.toThrow('HTTP verb "FOO" not understood.');
    });

    it('should retry if internal axios error is thrown', async () => {
      // Arrange
      const url = 'http://example.com';
      const httpVerb = 'POST';
      const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
      };
      const axiosMock = jest
        .spyOn(axios, 'post')
        .mockRejectedValueOnce(new Error('foo'))
        .mockResolvedValueOnce({
          status: 200,
          data: { foo: 'bar' },
        });
      const delayFunc = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = makeRequest({
        url,
        httpVerb,
        logger: logger as unknown as BaseLogger,
        delayFunc,
      });

      // Assert
      await expect(result).resolves.toEqual({
        status: 200,
        data: { foo: 'bar' },
      });
      expect(axiosMock).toHaveBeenCalledWith(url, undefined, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: expect.any(Function),
      });
      expect(logger.warn).toHaveBeenCalledWith(
        {
          err: expect.any(Error),
        },
        'Error occurred when making request to function provider',
      );
    });
  });
});
