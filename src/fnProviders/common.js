const _ = require('lodash');
const axios = require('axios');
const buildUrl = require('build-url');

const globals = require('../globals');

/**
 *
 * @param {string} urlRoot
 * @param {object} data
 * @param {string} data.path
 * @param {object} [data.body]
 * @param {object} [data.headers]
 * @param {string} data.httpVerb
 * @param {object} [retryMeta]
 * @param {number} [retryMeta.attempt]
 * @param {number} [retryMeta.maxAttempt]
 */
const makeRequest = async (urlRoot, data, retryMeta = {}) => {
  const logger = globals.getLogger();
  const requestId = globals.generateRandomString(32);
  const requestOptions = {
    headers: _.merge(
      {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data.headers,
    ),
    validateStatus: () => true,
  };

  const url = buildUrl(urlRoot, data);

  logger.debug(
    {
      url,
      urlRoot,
      requestId,
    },
    'Attempting to make provider request',
  );

  let resp;
  let throwUnknownVerb = false;
  try {
    switch (data.httpVerb.toUpperCase()) {
      case 'GET':
        resp = await axios.get(url, requestOptions);
        break;
      case 'POST':
        resp = await axios.post(url, data.body, requestOptions);
        break;
      case 'DELETE':
        resp = await axios.delete(url, requestOptions);
        break;
      default:
        throwUnknownVerb = true;
    }
  } catch (err) /* istanbul ignore next */ {
    const doNotBlock = ['ERR_NOCK_NO_MATCH'];
    if (doNotBlock.indexOf(err.code) > -1) throw err;

    logger.warn(
      { requestId, err },
      'Error occurred when making request to function provider.',
    );
  }

  /* istanbul ignore if */
  if (throwUnknownVerb) {
    throw new Error(`HTTP verb "${data.httpVerb}" not understood.`);
  }

  const attempt = _.get(retryMeta, ['attempt'], 1);
  const maxAttempt = _.get(retryMeta, ['maxAttempt'], 3);
  if ((resp === undefined || resp.status > 499) && attempt < maxAttempt) {
    logger.warn(
      { requestId, status: resp.status },
      'Provider error encountered. Retrying after delay',
    );
    await globals.delay(500 * attempt);
    return makeRequest(urlRoot, data, { attempt: attempt + 1, maxAttempt });
  }

  return resp;
};

module.exports = {
  makeRequest,
};
