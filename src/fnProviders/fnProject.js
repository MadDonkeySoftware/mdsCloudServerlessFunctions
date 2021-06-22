/* eslint-disable */
// http://petstore.swagger.io/?url=https://raw.githubusercontent.com/fnproject/fn/master/docs/swagger_v2.yml
// http://192.168.5.90:8080/v2/fns?app_id=01DNG262GXNG8G00GZJ0000010
// TODO: Update this provider to follow pattern
// const _ = require('lodash');
// const stringTemplate = require('string-template');
// const axios = require('axios');
// const mds = require('@maddonkeysoftware/mds-cloud-sdk-node');

// const globals = require('../globals');
// const helpers = require('../helpers');
// const common = require('./common');
// const simpleThrottle = require('../simpleThrottle');

// const NAME = 'fnProject';

// /**
//  *
//  * @param {object} data
//  * @param {string} data.path
//  * @param {object} [data.body]
//  * @param {string} data.httpVerb
//  * @param {object} [retryMeta]
//  * @param {number} [retryMeta.attempt]
//  * @param {number} [retryMeta.maxAttempt]
//  */
// const makeRequest = async (data, retryMeta = {}) => {
//   const urlRoot = helpers.getEnvVar('MDS_FN_FNPROJECT_URL', 'http://127.0.0.1:8080');
//   return common.makeRequest(urlRoot, data, retryMeta);
// };

// const buildAppName = ({ account }) => `mdsFn-${account}`;

// const getAppsPagedData = async ({
//   runningData,
//   dataKey,
// }) => {
//   const logger = globals.getLogger();
//   const reqData = { path: '/v2/apps', httpVerb: 'get' };
//   if (dataKey) {
//     reqData.queryParams = {
//       cursor: dataKey,
//     };
//   }

//   const resp = await makeRequest(reqData);
//   if (resp.status === 200) {
//     const newRunningData = _.concat([], runningData, resp.data.items);
//     if (resp.data.next_cursor) {
//       return getAppsPagedData({
//         runningData: newRunningData,
//         dataKey: resp.data.next_cursor,
//       });
//     }
//     return newRunningData;
//   }

//   logger.error({ status: resp.status, response: resp.data }, 'Failed to get application list in fnProject and retries exhausted.');
//   throw new Error('Could not get application list from provider');
// };

// const getApps = async () => {
//   const data = await getAppsPagedData({ runningData: [] });
//   return data;
// };

// const findAppIdByName = async (name) => {
//   const apps = await getApps();
//   const item = _.find(apps, (e) => e.name === name);
//   return _.get(item, ['id']);
// };

// const createApp = async (account) => {
//   const logger = globals.getLogger();
//   const name = buildAppName({ account });
//   const body = { name };
//   const resp = await makeRequest({ path: '/v2/apps', httpVerb: 'post', body });
//   if (resp.status === 200) {
//     return resp.data.id;
//   }
//   if (resp.status === 409) {
//     return findAppIdByName(name);
//   }
//   logger.warn({ status: resp.status, response: resp.data }, 'Failed to create application in fnProject.');
//   return undefined;
// };

// const deleteFunction = async (funcId) => {
//   const logger = globals.getLogger();
//   const resp = await makeRequest({ path: `/v2/fns/${funcId}`, httpVerb: 'delete' });
//   switch (resp.status) {
//     case 204:
//     case 404:
//       return true;
//     default:
//       logger.warn({ status: resp.status, response: resp.data }, 'Failed to delete function in fnProject.');
//       return false;
//   }
// };

// const buildInvokeUrlForFunction = (funcId) => {
//   const template = helpers.getEnvVar('MDS_FN_INVOKE_URL_TEMPLATE');
//   /* istanbul ignore else */
//   if (template) {
//     return stringTemplate(template, { funcId });
//   }

//   /* istanbul ignore next */
//   return undefined;
// };

// /*
// const ensureProviderAppForFunction = async (db, runtime, accountId) => {
//   const providerMetadataCol = db.getCollection('providerMetadata');
//   const provider = fnProvider.getProviderForRuntime(runtime);

//   const meta = await providerMetadataCol.findOne({ accountId });
//   let appId = _.get(meta, [provider.NAME]);
//   if (!appId) {
//     appId = await provider.findAppIdByName(provider.buildAppName({ account: accountId }));
//     if (!appId) {
//       appId = await provider.createApp(provider.buildAppName({ account: accountId }));
//     }

//     if (appId) {
//       const updateData = {};
//       updateData[provider.NAME] = appId;
//       await providerMetadataCol.updateOne(
//         { accountId },
//         { $set: updateData },
//         { upsert: true },
//       );

//       return { appId, name: provider.NAME };
//     }

//     logger.error(
//       { providerName: provider.NAME, runtime, accountId },
//       'Could not create provider application.'
//     );
//     return {};
//   }

//   return { appId, name: provider.NAME };
// };
// */

// /*
//     const throttleKey = `mdsFn-${accountId}:${resourceId}`;
//     if (isTruthy(helpers.getEnvVar('MDS_FN_USE_INVOKE_THROTTLE'))) {
//       try {
//         await simpleThrottle.acquire(throttleKey);
//       } catch (err) {
//         const respBody = JSON.stringify({
//           id: resourceId,
//           message: 'Too many requests',
//         });
//         return handlerHelpers.sendResponse(response, 429, respBody);
//       }
//     }
// */

// const invokeFunctionWithRetry = async (invokeUrl, body, retryMeta) => {
//   const logger = globals.getLogger();
//   const postOptions = {
//     headers: {
//       Accept: 'application/json',
//       'Content-Type': 'application/json',
//     },
//     validateStatus: () => true, // Don't reject on any request
//   };

//   const attempt = _.get(retryMeta, ['attempt'], 1);
//   const maxAttempt = _.get(retryMeta, ['maxAttempt'], 3);
//   try {
//     const resp = await axios.post(invokeUrl, body, postOptions);
//     if (resp.status > 499 && attempt < maxAttempt) {
//       await globals.delay(500 * attempt);
//       return invokeFunctionWithRetry(invokeUrl, body, { attempt: attempt + 1, maxAttempt });
//     }

//     return resp;
//   } catch (err) {
//     logger.warn(
//       { err, attempt, maxAttempt },
//       'Error encountered while attempting to invoke function.',
//     );
//     if (attempt >= maxAttempt) {
//       throw err;
//     }

//     await globals.delay(1000 * attempt);
//     return invokeFunctionWithRetry(invokeUrl, body, { attempt: attempt + 1, maxAttempt });
//   }
// };

// module.exports = {
//   NAME,
//   // createApp,
//   // findAppIdByName,
//   // deleteFunction,
//   // TODO: Map to standard functions
// };
