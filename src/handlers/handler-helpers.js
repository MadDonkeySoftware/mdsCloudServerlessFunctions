/*
NOTE: We use the exported version of many methods in this module to allow
the unit tests to easily stub.
*/
const _ = require('lodash');
const axios = require('axios');
const orid = require('@maddonkeysoftware/orid-node');
const jwt = require('jsonwebtoken');
const urlJoin = require('url-join');

let SIGNATURE;

const getIssuer = () => process.env.ORID_PROVIDER_KEY;

const getAppPublicSignature = async () => {
  if (!SIGNATURE) {
    const url = urlJoin(process.env.MDS_IDENTITY_URL || 'http://localhost', 'v1', 'publicSignature');
    const resp = await axios.get(url);
    SIGNATURE = _.get(resp, ['data', 'signature']);
  }
  return SIGNATURE;
};

const sendResponse = (response, status, body) => {
  response.status(status || 200);
  response.send(body);
  return Promise.resolve();
};

const recombineUrlParts = (params, key) => {
  let value = params[key];
  let i = 0;

  while (params[i] && i <= Number.MAX_SAFE_INTEGER) {
    value += params[i];
    i += 1;
  }

  return value;
};

const getOridFromRequest = (request, key) => {
  const { params } = request;
  const input = recombineUrlParts(params, key);
  const reqOrid = orid.v1.isValid(input) ? orid.v1.parse(input) : undefined;

  return reqOrid;
};

const validateToken = (logger) => async (request, response, next) => {
  const { headers } = request;
  const { token } = headers;
  if (!token) {
    response.setHeader('content-type', 'text/plain');
    return module.exports.sendResponse(response, 403, 'Please include authentication token in header "token"');
  }

  try {
    const publicSignature = await module.exports.getAppPublicSignature();
    const parsedToken = jwt.verify(token, publicSignature, { complete: true });
    if (parsedToken && parsedToken.payload.iss === module.exports.getIssuer()) {
      request.parsedToken = parsedToken;
    } else {
      /* istanbul ignore else */
      if (logger) logger.debug({ token: parsedToken }, 'Invalid token detected.');
      return module.exports.sendResponse(response, 403);
    }
  } catch (err) {
    /* istanbul ignore else */
    if (logger) logger.debug({ err }, 'Error detected while parsing token.');
    return module.exports.sendResponse(response, 403);
  }
  return next();
};

const ensureRequestOrid = (withRider, key) => (request, response, next) => {
  const reqOrid = module.exports.getOridFromRequest(request, key);

  if (!reqOrid || (withRider && !reqOrid.resourceRider)) {
    response.setHeader('content-type', 'text/plain');
    return module.exports.sendResponse(response, 400, 'resource not understood');
  }

  return next();
};

const canAccessResource = ({ oridKey, logger }) => (request, response, next) => {
  const reqOrid = module.exports.getOridFromRequest(request, oridKey);

  const tokenAccountId = _.get(request, ['parsedToken', 'payload', 'accountId']);
  if (tokenAccountId !== reqOrid.custom3 && tokenAccountId !== '1') {
    /* istanbul ignore else */
    if (logger) {
      logger.debug(
        { tokenAccountId, requestAccount: reqOrid.custom3 },
        'Insufficient privilege for request',
      );
    }
    return module.exports.sendResponse(response, 403);
  }

  return next();
};

module.exports = {
  getIssuer,
  getAppPublicSignature,
  sendResponse,
  recombineUrlParts,
  getOridFromRequest,
  validateToken,
  ensureRequestOrid,
  canAccessResource,
};
