const _ = require('lodash');
const FormData = require('form-data');
const fs = require('fs');
const AuthManager = require('@maddonkeysoftware/mds-cloud-sdk-node/src/lib/auth-manager');
const InMemCache = require('@maddonkeysoftware/mds-cloud-sdk-node/src/lib/in-memory-cache');

const globals = require('../globals');
const common = require('./common');
const helpers = require('../helpers');

// TODO: Parse allow self sign cert for truthy
const isTruthy = (value) => value.toLowerCase() === 'true';

/**
 *
 * @param {string} baseUrl The base URL used for the mdsCloud docker provider
 */
function constructor(baseUrl) {
  this.baseUrl = baseUrl;
  this.authManager = new AuthManager({
    cache: new InMemCache(),
    identityUrl: helpers.getEnvVar('MDS_IDENTITY_URL'),
    userId: helpers.getEnvVar('MDS_FN_SYS_USER'),
    password: helpers.getEnvVar('MDS_FN_SYS_PASSWORD'),
    account: helpers.getEnvVar('MDS_FN_SYS_ACCOUNT'),
    allowSelfSignCert: !!isTruthy(helpers.getEnvVar('MDS_FN_SYS_ALLOW_SELFSIGN_CERT', '')),
  });
}

constructor.prototype.createFunction = async function createFunction(name, accountId) {
  const logger = globals.getLogger();
  const body = { name, accountId };
  const token = await this.authManager.getAuthenticationToken();
  const resp = await common.makeRequest(
    this.baseUrl,
    {
      path: '/v1/createFunction',
      httpVerb: 'post',
      headers: { token },
      body,
    },
  );

  if (resp.status === 201) {
    return resp.data.id;
  }

  logger.warn({ status: resp.status, response: resp.data }, 'Failed to create MDSCloud function.');
  return undefined;
};

constructor.prototype.updateFunction = async function updateFunction(
  functionId, sourcePath, runtime, entryPoint, context,
) {
  const form = new FormData();
  form.append('functionId', functionId);
  form.append('sourceArchive', fs.createReadStream(sourcePath));
  form.append('runtime', runtime);
  form.append('entryPoint', entryPoint);
  if (context) {
    form.append('context', context);
  }
  const token = await this.authManager.getAuthenticationToken();
  const headers = _.merge(
    {},
    { token },
    form.getHeaders(),
  );

  const resp = await common.makeRequest(
    this.baseUrl,
    {
      path: '/v1/buildFunction',
      httpVerb: 'post',
      headers,
      body: form,
    },
  );

  if (resp.status === 200) {
    return true;
  }

  const logger = globals.getLogger();
  logger.warn({ status: resp.status, response: resp.data }, 'Failed to update MDSCloud function.');
  return false;
};

constructor.prototype.invokeFunction = async function invokeFunction(functionId, payload) {
  const token = await this.authManager.getAuthenticationToken();
  const resp = await common.makeRequest(
    this.baseUrl,
    {
      path: `/v1/executeFunction/${functionId}`,
      httpVerb: 'post',
      headers: { token },
      body: payload,
    },
  );

  if (resp.status === 200) {
    return {
      status: resp.status,
      data: resp.data,
    };
  }

  const logger = globals.getLogger();
  logger.warn({ status: resp.status, response: resp.data }, 'Failed to invoke MDSCloud function.');
  return undefined;
};

constructor.prototype.deleteFunction = async function deleteFunction(functionId) {
  const token = await this.authManager.getAuthenticationToken();
  const resp = await common.makeRequest(
    this.baseUrl,
    {
      path: `/v1/${functionId}`,
      headers: { token },
      httpVerb: 'delete',
    },
  );

  if (resp.status === 200) {
    return true;
  }

  const logger = globals.getLogger();
  logger.warn({ functionId, status: resp.status, response: resp.data }, 'Failed to delete MDSCloud function.');
  return false;
};

module.exports = constructor;
