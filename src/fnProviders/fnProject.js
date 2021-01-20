// http://petstore.swagger.io/?url=https://raw.githubusercontent.com/fnproject/fn/master/docs/swagger_v2.yml
// http://192.168.5.90:8080/v2/fns?app_id=01DNG262GXNG8G00GZJ0000010
const _ = require('lodash');
const axios = require('axios');
const buildUrl = require('build-url');

const globals = require('../globals');
const helpers = require('../helpers');

const NAME = 'fnProject';

/**
 *
 * @param {object} data
 * @param {string} data.path
 * @param {object} [data.body]
 * @param {string} data.httpVerb
 * @param {object} [retryMeta]
 * @param {number} [retryMeta.attempt]
 * @param {number} [retryMeta.maxAttempt]
 */
const makeRequest = async (data, retryMeta = {}) => {
  const requestOptions = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  };

  const url = buildUrl(
    helpers.getEnvVar('MDS_FN_FNPROJECT_URL', 'http://127.0.0.1:8080'),
    data,
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
      /* istanbul ignore next */
      default:
        throwUnknownVerb = true;
    }
  } catch (err) {
    const doNotBlock = ['ERR_NOCK_NO_MATCH'];
    if (doNotBlock.indexOf(err.code) > -1) throw err;

    const logger = globals.getLogger();
    logger.warn({ err }, 'Error occurred when making request to fnProject server.');
  }

  /* istanbul ignore if */
  if (throwUnknownVerb) {
    throw new Error(`HTTP verb "${data.httpVerb}" not understood.`);
  }

  const attempt = _.get(retryMeta, ['attempt'], 1);
  const maxAttempt = _.get(retryMeta, ['maxAttempt'], 3);
  if ((resp === undefined || resp.status > 499) && attempt < maxAttempt) {
    return globals.delay(500 * attempt)
      .then(() => makeRequest(data, { attempt: attempt + 1, maxAttempt }));
  }

  return resp;
};

const getAppsPagedData = async ({
  runningData,
  dataKey,
}) => {
  const logger = globals.getLogger();
  const reqData = { path: '/v2/apps', httpVerb: 'get' };
  if (dataKey) {
    reqData.queryParams = {
      cursor: dataKey,
    };
  }

  const resp = await makeRequest(reqData);
  if (resp.status === 200) {
    const newRunningData = _.concat([], runningData, resp.data.items);
    if (resp.data.next_cursor) {
      return getAppsPagedData({
        runningData: newRunningData,
        dataKey: resp.data.next_cursor,
      });
    }
    return newRunningData;
  }

  logger.error({ status: resp.status, response: resp.data }, 'Failed to get application list in fnProject and retries exhausted.');
  throw new Error('Could not get application list from provider');
};

const getApps = async () => {
  const data = await getAppsPagedData({ runningData: [] });
  return data;
};

const createApp = async (name) => {
  const logger = globals.getLogger();
  const body = { name };
  const resp = await makeRequest({ path: '/v2/apps', httpVerb: 'post', body });
  if (resp.status === 200) {
    return resp.data.id;
  }
  logger.warn({ status: resp.status, response: resp.data }, 'Failed to create application in fnProject.');
  return undefined;
};

const findAppIdByName = async (name) => {
  const apps = await getApps();
  const item = _.find(apps, (e) => e.name === name);
  return _.get(item, ['id']);
};

const deleteFunction = async (funcId) => {
  const logger = globals.getLogger();
  const resp = await makeRequest({ path: `/v2/fns/${funcId}`, httpVerb: 'delete' });
  switch (resp.status) {
    case 204:
    case 404:
      return true;
    default:
      logger.warn({ status: resp.status, response: resp.data }, 'Failed to delete function in fnProject.');
      return false;
  }
};

module.exports = {
  NAME,
  createApp,
  findAppIdByName,
  deleteFunction,
};
