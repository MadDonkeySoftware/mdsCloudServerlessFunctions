const _ = require('lodash');
const express = require('express');
const uuid = require('uuid');
const orid = require('@maddonkeysoftware/orid-node');
const os = require('os');
const path = require('path');
const fs = require('fs');
const VError = require('verror');

const handlerHelpers = require('../handler-helpers');
const repo = require('../../repo');
const createValidator = require('../../validators/create');
const uploadCodeValidator = require('../../validators/uploadCode');
const fnProvider = require('../../fnProviders');
const globals = require('../../globals');
const helpers = require('../../helpers');

const router = express.Router();
const logger = globals.getLogger();

const oridBase = {
  provider: handlerHelpers.getIssuer(),
  service: 'sf',
};

const makeOrid = (resourceId, accountId) =>
  orid.v1.generate(
    _.merge({}, oridBase, {
      resourceId,
      custom3: accountId,
    }),
  );

const createFunction = async (request, response) => {
  const { body } = request;
  const { accountId } = request.parsedToken.payload;

  const validationResult = createValidator.validate(body);
  if (!validationResult.valid) {
    return handlerHelpers.sendResponse(
      response,
      400,
      JSON.stringify(validationResult.errors),
    );
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

    const findResult = await functionsCol.findOne({
      name: body.name,
      accountId,
    });

    if (findResult) {
      return handlerHelpers.sendResponse(
        response,
        409,
        JSON.stringify({ id: findResult.id }),
      );
    }

    const newItem = _.merge(
      {},
      {
        id: uuid.v4(),
        accountId,
        created: new Date().toISOString(),
        version: 0,
      },
      body,
    );

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

    return functionsCol
      .find({ accountId })
      .toArray()
      .then((findResults) => {
        const result = _.map(findResults, (e) => ({
          name: e.name,
          orid: makeOrid(e.id, accountId),
        }));
        return handlerHelpers.sendResponse(
          response,
          200,
          JSON.stringify(result),
        );
      })
      .finally(() => db.close());
  });
};

const deleteFunction = async (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');
    const dbFunc = await functionsCol.findOne({ id: resourceId, accountId });
    if (dbFunc) {
      const provider = await fnProvider.getProviderForRuntime(dbFunc.runtime);
      if (provider) {
        const deleted = await provider.deleteFunction(dbFunc.providerFuncId);
        if (deleted) {
          await functionsCol.deleteOne({ id: resourceId, accountId });
          return handlerHelpers.sendResponse(response, 204);
        }
        logger.warn({ requestOrid }, 'Failed to delete function from provider');
        return handlerHelpers.sendResponse(response, 500);
      }
      await functionsCol.deleteOne({ id: resourceId, accountId });
      return handlerHelpers.sendResponse(response, 204);
    }
    return handlerHelpers.sendResponse(response, 404);
  } finally {
    db.close();
  }
};

const uploadCodeToFunction = async (request, response) => {
  const { body, files } = request;

  const validationResult = uploadCodeValidator.validate(body);
  if (!validationResult.valid) {
    logger.debug({ validationResult }, 'Update code request invalid');
    const respBody = JSON.stringify(validationResult.errors);
    return handlerHelpers.sendResponse(response, 400, respBody);
  }

  if (!files || !files.sourceArchive) {
    const respBody = JSON.stringify([
      { message: 'sourceArchive missing from payload' },
    ]);
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
    const findResult = await functionsCol.findOne({
      id: resourceId,
      accountId,
    });

    if (!findResult) {
      const respBody = JSON.stringify({
        id: resourceId,
        message: 'Function not found.',
      });
      return handlerHelpers.sendResponse(response, 404, respBody);
    }

    // Ensure the provider has the function created
    const provider = await fnProvider.getProviderForRuntime(body.runtime);

    let { providerFuncId } = findResult;
    if (!providerFuncId) {
      providerFuncId = await provider.createFunction(
        findResult.name,
        accountId,
      );
      if (!providerFuncId) {
        logger.warn(
          { accountId, resourceId },
          'No provider function id returned when creating the function.',
        );
        return handlerHelpers.sendResponse(response, 500);
      }
    }

    const updatePayload = {
      $set: {
        providerFuncId,
        lastUpdate: new Date().toISOString(),
        runtime: body.runtime,
        entryPoint: body.entryPoint,
      },
      // $inc: { version: 1 },
    };

    await functionsCol.updateOne({ id: resourceId }, updatePayload, options);

    // We need to make sure the file name is unique in case a single archive is used for multiple
    // function code uploads.
    // TODO: There has to be a way to do this without writing the file to disk.
    const distinctFile = `${globals.generateRandomString(8)}-${
      files.sourceArchive.name
    }`;
    const localFilePath = `${os.tmpdir()}${path.sep}${distinctFile}`;
    logger.debug({ localFilePath }, 'Saving soure archive locally');
    await helpers.saveRequestFile(files.sourceArchive, localFilePath);

    const wasSuccessful = await provider.updateFunction(
      providerFuncId,
      localFilePath,
      body.runtime,
      body.entryPoint,
      body.context,
    );
    await new Promise((res) => {
      fs.unlink(localFilePath, () => {
        res();
      });
    });
    logger.debug(
      {
        wasSuccessful,
        providerFuncId,
      },
      'Attempted to update provider function',
    );
    // TODO: Resume Below Here
    const respObj = {
      id: resourceId,
      status: wasSuccessful ? 'buildComplete' : 'buildFailed',
    };

    /* istanbul ignore else */
    if (wasSuccessful) {
      // respObj.invokeUrl = buildInvokeUrlForFunction(resourceId);
      respObj.orid = makeOrid(resourceId, accountId);
    }

    const respBody = JSON.stringify(respObj);
    return handlerHelpers.sendResponse(response, 201, respBody);
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

const isTruthy = (value) => {
  const casedValue = `${value}`.toUpperCase();
  return casedValue === 'TRUE' || casedValue === '1' || casedValue === 'T';
};

const invokeFunction = async (request, response) => {
  const { body, query } = request;

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const db = await repo.getDatabase();
  try {
    const functionsCol = db.getCollection('functions');

    const findResult = await functionsCol.findOne({
      id: resourceId,
      accountId,
    });

    if (!findResult) {
      const respBody = { id: resourceId, message: 'Function not found.' };
      return handlerHelpers.sendResponse(
        response,
        404,
        JSON.stringify(respBody),
      );
    }

    const provider = await fnProvider.getProviderForRuntime(findResult.runtime);
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

    await functionsCol.updateOne(
      { id: resourceId, accountId },
      updatePayload,
      options,
    );

    // TODO: Update this code.
    const { providerFuncId } = findResult;
    if (providerFuncId) {
      try {
        if (isTruthy(query.async)) {
          provider.invokeFunction(providerFuncId, body);
          const respBody = JSON.stringify({
            message: 'Request accepted. Function should begin soon.',
          });
          return handlerHelpers.sendResponse(response, 202, respBody);
        }
        const resp = await provider.invokeFunction(providerFuncId, body);
        return handlerHelpers.sendResponse(
          response,
          resp.status,
          JSON.stringify(resp.data),
        );
      } catch (err) {
        logger.error({ err }, 'Failed when invoking function');
        return handlerHelpers.sendResponse(response, 500);
      }
    }

    const respBody = JSON.stringify({
      id: resourceId,
      message:
        'Function does not appear to have code associated yet. Please upload code then try again.',
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

    const findResult = await functionsCol.findOne({
      id: resourceId,
      accountId,
    });

    if (!findResult) {
      const respBody = { id: resourceId, message: 'Function not found.' };
      return handlerHelpers.sendResponse(response, 404, respBody);
    }

    // TODO: Research putting version back on here.
    const respBody = {
      id: findResult.id,
      orid: makeOrid(findResult.id, accountId),
      name: findResult.name,
      // version: `${findResult.version}`,
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

router.post('/create', handlerHelpers.validateToken(logger), createFunction);
router.get('/list', handlerHelpers.validateToken(logger), listFunctions);
router.delete(
  '/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  deleteFunction,
);
router.post(
  '/uploadCode/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  uploadCodeToFunction,
);
router.post(
  '/invoke/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  invokeFunction,
);
router.get(
  '/inspect/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  inspectFunction,
);

module.exports = router;
