const _ = require('lodash');
const express = require('express');
const uuid = require('uuid');
const mds = require('@maddonkeysoftware/mds-cloud-sdk-node');
const orid = require('@maddonkeysoftware/orid-node');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const stringTemplate = require('string-template');
const VError = require('verror');

const handlerHelpers = require('../handler-helpers');
const repo = require('../../repo');
const createValidator = require('../../validators/create');
const uploadCodeValidator = require('../../validators/uploadCode');
const fnProvider = require('../../fnProviders');
const globals = require('../../globals');
const helpers = require('../../helpers');
const simpleThrottle = require('../../simpleThrottle');

const router = express.Router();
const logger = globals.getLogger();

const oridBase = {
  provider: handlerHelpers.getIssuer(),
  service: 'sf',
};

const makeOrid = (resourceId, accountId) => orid.v1.generate(_.merge({}, oridBase, {
  resourceId,
  custom3: accountId,
}));

const createFunction = async (request, response) => {
  const { body } = request;
  const { accountId } = request.parsedToken.payload;

  const validationResult = createValidator.validate(body);
  if (!validationResult.valid) {
    return handlerHelpers.sendResponse(response, 400, JSON.stringify(validationResult.errors));
  }

  const options = {
    writeConcern: {
      w: 'majority',
      j: true,
      wtimeout: 30000, // milliseconds
    },
  };

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');

    const findResult = await functionsCol.findOne({ name: body.name, accountId });

    if (findResult) {
      return handlerHelpers.sendResponse(response, 409, JSON.stringify({ id: findResult.id }));
    }

    const newItem = _.merge({}, {
      id: uuid.v4(),
      accountId,
      created: new Date().toISOString(),
      version: 0,
    }, body);

    await functionsCol.insertOne(newItem, options);
    const respBody = {
      name: body.name,
      orid: makeOrid(newItem.id, accountId),
    };
    return handlerHelpers.sendResponse(response, 201, JSON.stringify(respBody));
  } finally {
    db.close();
  }
};

const listFunctions = (request, response) => {
  const { accountId } = request.parsedToken.payload;

  return repo.getDatabase().then((db) => {
    const functionsCol = db.getCollection('functions');

    return functionsCol.find({ accountId }).toArray().then((findResults) => {
      const result = _.map(
        findResults,
        (e) => ({
          name: e.name,
          orid: makeOrid(e.id, accountId),
        }),
      );
      return handlerHelpers.sendResponse(response, 200, JSON.stringify(result));
    }).finally(() => db.close());
  });
};

const deleteFunction = (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repo.getDatabase().then((db) => {
    const functionsCol = db.getCollection('functions');

    return functionsCol.findOne({ id: resourceId, accountId }).then((dbFunc) => {
      if (dbFunc) {
        const provider = fnProvider.getProviderForRuntime(dbFunc.runtime);
        if (provider) {
          return provider.deleteFunction(dbFunc.funcId).then((deleted) => {
            if (deleted) {
              return functionsCol.deleteOne({ id: resourceId, accountId })
                .then(() => handlerHelpers.sendResponse(response, 204));
            }

            logger.warn({ requestOrid }, 'Failed to delete function from provider');
            return handlerHelpers.sendResponse(response, 500);
          });
        }

        return functionsCol.deleteOne({ id: resourceId, accountId })
          .then(() => handlerHelpers.sendResponse(response, 204));
      }

      return handlerHelpers.sendResponse(response, 404);
    }).finally(() => db.close());
  });
};

const ensureProviderAppForFunction = async (db, runtime, accountId) => {
  const providerMetadataCol = db.getCollection('providerMetadata');
  const provider = fnProvider.getProviderForRuntime(runtime);

  const meta = await providerMetadataCol.findOne({ accountId });
  let appId = _.get(meta, [provider.NAME]);
  if (!appId) {
    appId = await provider.findAppIdByName(provider.buildAppName({ account: accountId }));
    if (!appId) {
      appId = await provider.createApp(provider.buildAppName({ account: accountId }));
    }

    if (appId) {
      const updateData = {};
      updateData[provider.NAME] = appId;
      await providerMetadataCol.updateOne(
        { accountId },
        { $set: updateData },
        { upsert: true },
      );

      return { appId, name: provider.NAME };
    }

    logger.error({ providerName: provider.NAME, runtime, accountId }, 'Could not create provider application.');
    return {};
  }

  return { appId, name: provider.NAME };
};

const buildInvokeUrlForFunction = (funcId) => {
  const template = helpers.getEnvVar('MDS_FN_INVOKE_URL_TEMPLATE');
  /* istanbul ignore else */
  if (template) {
    return stringTemplate(template, { funcId });
  }

  /* istanbul ignore next */
  return undefined;
};

const uploadCodeToFunction = async (request, response) => {
  const WORK_CONTAINER = helpers.getEnvVar('MDS_FN_WORK_CONTAINER');
  const WORK_QUEUE = helpers.getEnvVar('MDS_FN_WORK_QUEUE');
  const NOTIFICATION_WORK = helpers.getEnvVar('MDS_FN_NOTIFICATION_TOPIC');

  const {
    body,
    files,
  } = request;

  const validationResult = uploadCodeValidator.validate(body);
  if (!validationResult.valid) {
    const respBody = JSON.stringify(validationResult.errors);
    return handlerHelpers.sendResponse(response, 400, respBody);
  }

  if (!files || !files.sourceArchive) {
    const respBody = JSON.stringify([{ message: 'sourceArchive missing from payload' }]);
    return handlerHelpers.sendResponse(response, 400, respBody);
  }

  const options = {
    writeConcern: {
      w: 'majority',
      j: true,
      wtimeout: 30000, // milliseconds
    },
  };

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');
    const findResult = await functionsCol.findOne({ id: resourceId, accountId });

    if (!findResult) {
      const respBody = JSON.stringify({ id: resourceId, message: 'Function not found.' });
      return handlerHelpers.sendResponse(response, 404, respBody);
    }

    const providerData = await ensureProviderAppForFunction(db, body.runtime, accountId);

    if (!providerData.appId) {
      const logId = uuid.v4();
      logger.warn({ logId }, 'Unable to create application as provider did not yield application id.');

      const respBody = JSON.stringify({
        message: 'An internal error has occurred',
        referenceNumber: logId,
      });
      return handlerHelpers.sendResponse(response, 500, respBody);
    }

    const updatePayload = {
      $set: {
        lastUpdate: new Date().toISOString(),
        provider: providerData.name,
        providerAppId: providerData.appId,
        runtime: body.runtime,
        entryPoint: body.entryPoint,
      },
      $inc: { version: 1 },
    };

    await functionsCol.updateOne(
      { id: resourceId },
      updatePayload,
      options,
    );
    const fsClient = mds.getFileServiceClient();
    const qsClient = mds.getQueueServiceClient();
    const nsClient = mds.getNotificationServiceClient();

    // We need to make sure the file name is unique in case a single archive is used for multiple
    // function code uploads.
    const distinctFile = `${globals.generateRandomString(8)}-${files.sourceArchive.name}`;
    const localFilePath = `${os.tmpdir()}${path.sep}${distinctFile}`;
    await helpers.saveRequestFile(files.sourceArchive, localFilePath);
    await fsClient.uploadFile(WORK_CONTAINER, localFilePath);
    await new Promise((res) => { fs.unlink(localFilePath, () => { res(); }); });
    await qsClient.enqueueMessage(WORK_QUEUE, {
      functionId: resourceId,
      sourceContainer: WORK_CONTAINER,
      sourcePath: distinctFile,
    });
    const eventId = uuid.v4();
    await nsClient.emit(NOTIFICATION_WORK, { queue: WORK_QUEUE, eventId });

    return new Promise((resolve) => {
      nsClient.on(NOTIFICATION_WORK, (event) => {
        const details = event.message;
        /* istanbul ignore else */
        if (details.eventId === eventId) {
          const finalizedStatuses = ['buildComplete', 'buildFailed'];
          /* istanbul ignore else */
          if (finalizedStatuses.indexOf(details.status) > -1) {
            nsClient.close();

            const respObj = {
              id: resourceId,
              status: details.status,
            };

            /* istanbul ignore else */
            if (details.status === 'buildComplete') {
              respObj.invokeUrl = buildInvokeUrlForFunction(resourceId);
              respObj.orid = makeOrid(resourceId, accountId);
            }

            const respBody = JSON.stringify(respObj);
            resolve();
            handlerHelpers.sendResponse(response, 201, respBody)
              .then(() => resolve());
          }
        }
      });
    });
  } catch (err) {
    logger.error(
      { err, requestOrid, info: VError.info(err) },
      'An error occurred while attempting to update the function.',
    );
    return handlerHelpers.sendResponse(response, 500);
  } finally {
    db.close();
  }
};

const invokeFunctionWithRetry = async (invokeUrl, body, retryMeta) => {
  const postOptions = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    validateStatus: () => true, // Don't reject on any request
  };

  const attempt = _.get(retryMeta, ['attempt'], 1);
  const maxAttempt = _.get(retryMeta, ['maxAttempt'], 3);
  try {
    const resp = await axios.post(invokeUrl, body, postOptions);
    if (resp.status > 499 && attempt < maxAttempt) {
      await globals.delay(500 * attempt);
      return invokeFunctionWithRetry(invokeUrl, body, { attempt: attempt + 1, maxAttempt });
    }

    return resp;
  } catch (err) {
    logger.warn(
      { err, attempt, maxAttempt },
      'Error encountered while attempting to invoke function.',
    );
    if (attempt >= maxAttempt) {
      throw err;
    }

    await globals.delay(1000 * attempt);
    return invokeFunctionWithRetry(invokeUrl, body, { attempt: attempt + 1, maxAttempt });
  }
};

const isTruthy = (value) => {
  const casedValue = `${value}`.toUpperCase();
  return (casedValue === 'TRUE'
    || casedValue === '1'
    || casedValue === 'T');
};

const invokeFunction = async (request, response) => {
  const {
    body,
    query,
  } = request;

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');

    const findResult = await functionsCol.findOne({ id: resourceId, accountId });

    if (!findResult) {
      const respBody = { id: resourceId, message: 'Function not found.' };
      return handlerHelpers.sendResponse(response, 404, JSON.stringify(respBody));
    }

    const updatePayload = {
      $set: {
        lastInvoke: new Date().toISOString(),
      },
    };
    const options = {
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 30000, // milliseconds
      },
    };

    const throttleKey = `mdsFn-${accountId}:${resourceId}`;
    if (isTruthy(helpers.getEnvVar('MDS_FN_USE_INVOKE_THROTTLE'))) {
      try {
        await simpleThrottle.acquire(throttleKey);
      } catch (err) {
        const respBody = JSON.stringify({
          id: resourceId,
          message: 'Too many requests',
        });
        return handlerHelpers.sendResponse(response, 429, respBody);
      }
    }

    await functionsCol.updateOne(
      { id: resourceId, accountId },
      updatePayload,
      options,
    );

    const { invokeUrl } = findResult;
    if (invokeUrl) {
      if (isTruthy(query.async)) {
        const respBody = JSON.stringify({
          message: 'Request accepted. Function should begin soon.',
        });
        handlerHelpers.sendResponse(response, 202, respBody);
      }

      try {
        const resp = await invokeFunctionWithRetry(invokeUrl, body);
        if (isTruthy(query.async)) {
          return Promise.resolve();
        }
        return handlerHelpers.sendResponse(response, resp.status, JSON.stringify(resp.data));
      } catch (err) {
        return handlerHelpers.sendResponse(response, 500);
      } finally {
        if (isTruthy(helpers.getEnvVar('MDS_FN_USE_INVOKE_THROTTLE'))) {
          simpleThrottle.release(throttleKey);
        }
      }
    }

    if (isTruthy(helpers.getEnvVar('MDS_FN_USE_INVOKE_THROTTLE'))) {
      simpleThrottle.release(throttleKey);
    }
    const respBody = JSON.stringify({
      id: resourceId,
      message: 'Function does not appear to have code associated yet. Please upload code then try again.',
    });
    return handlerHelpers.sendResponse(response, 422, respBody);
  } finally {
    db.close();
  }
};

const inspectFunction = async (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');

    const findResult = await functionsCol.findOne({ id: resourceId, accountId });

    if (!findResult) {
      const respBody = { id: resourceId, message: 'Function not found.' };
      return handlerHelpers.sendResponse(response, 404, respBody);
    }

    const respBody = {
      id: findResult.id,
      orid: makeOrid(findResult.id, accountId),
      name: findResult.name,
      version: `${findResult.version}`,
      runtime: findResult.runtime,
      entryPoint: findResult.entryPoint,
      created: findResult.created,
      lastUpdate: findResult.lastUpdate,
      lastInvoke: findResult.lastInvoke,
    };
    return handlerHelpers.sendResponse(response, 200, respBody);
  } finally {
    db.close();
  }
};

router.post('/create',
  handlerHelpers.validateToken(logger),
  createFunction);
router.get('/list',
  handlerHelpers.validateToken(logger),
  listFunctions);
router.delete('/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  deleteFunction);
router.post('/uploadCode/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  uploadCodeToFunction);
router.post('/invoke/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  invokeFunction);
router.get('/inspect/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  inspectFunction);

module.exports = router;
