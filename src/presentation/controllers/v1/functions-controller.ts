import { tmpdir } from 'os';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import config from 'config';
import { validateToken } from '../../hooks/validate-token';
import { validateRequestOridParam } from '../../hooks/validate-request-orid-param';
import { validateCanAccessOridParam } from '../../hooks/validate-can-access-orid-param';
import {
  CreateFunctionRequestBody,
  CreateFunctionRequestBodySchema,
  CreateFunctionResponseBodySchema,
  CreateFunctionConflictResponseBodySchema,
  FunctionActionRequestParams,
  FunctionActionRequestParamsSchema,
  ListFunctionsResponseBodySchema,
  UpdateFunctionResponseBodySchema,
  InvokeFunctionQueryParams,
  InvokeFunctionQueryParamsSchema,
} from '../../schemas';
import {
  FunctionExistsError,
  FunctionNotFoundError,
} from '../../../core/errors';
import { getFileUploadAndFormFields } from '../../functions';
import { InspectFunctionResponseBodySchema } from '../../schemas/functions/inspect-function-response-body-schema';
import { default as multer } from 'fastify-multer';
import { FastifyMulterFileRequest } from '../../types/fastify-multer-file';

const MULTER_UPLOAD = multer({ dest: tmpdir() });
const SWAGGER_NO_CONTENT = {
  type: 'null',
  description: 'no content',
};

export function functionsController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  app.addHook('onRequest', validateToken);
  app.addHook('preHandler', validateRequestOridParam);
  app.addHook('preHandler', validateCanAccessOridParam);

  function makeOridName(id: string, accountId: string) {
    return oridV1.generate({
      provider: config.get<string>('oridProviderKey'),
      service: 'sf',
      resourceId: id,
      custom3: accountId,
    });
  }

  app.get(
    '/list',
    {
      schema: {
        description: 'List functions',
        tags: ['Functions'],
        response: {
          200: ListFunctionsResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const queues = await (request.parsedToken!.payload.accountId === '1'
        ? request.services.logic.listFunctions()
        : request.services.logic.listFunctions(
            request.parsedToken!.payload.accountId,
          ));
      return response.send(
        queues.map((f) => ({
          name: f.name,
          orid: makeOridName(f.id, f.accountId),
        })),
      );
    },
  );

  app.post<{
    Body: CreateFunctionRequestBody;
  }>(
    '/create',
    {
      schema: {
        description: 'Create a function',
        tags: ['Functions'],
        body: CreateFunctionRequestBodySchema,
        response: {
          201: CreateFunctionResponseBodySchema,
          409: CreateFunctionConflictResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      try {
        const { body } = request;
        const newId = await request.services.logic.createFunction({
          name: body.name,
          accountId: request.parsedToken!.payload.accountId,
        });

        return response.status(201).send({
          name: body.name,
          orid: makeOridName(newId, request.parsedToken!.payload.accountId),
        });
      } catch (err) {
        if (err instanceof FunctionExistsError) {
          return response.status(409).send({
            orid: makeOridName(err.id, request.parsedToken!.payload.accountId),
          });
        }
        throw err;
      }
    },
  );

  app.delete<{
    Params: FunctionActionRequestParams;
  }>(
    '/:orid',
    {
      schema: {
        description: 'Delete a function',
        tags: ['Functions'],
        params: FunctionActionRequestParamsSchema,
        response: {
          204: SWAGGER_NO_CONTENT,
          404: SWAGGER_NO_CONTENT,
        },
      },
    },
    async (request, response) => {
      try {
        const parsedOrid = oridV1.parse(request.params.orid);
        await request.services.logic.deleteFunction({
          id: parsedOrid.resourceId,
          accountId: parsedOrid.custom3 as string,
        });
        return response.status(204).send();
      } catch (err) {
        if (err instanceof FunctionNotFoundError) {
          return response.status(404).send();
        }
        throw err;
      }
    },
  );

  app.post<{
    // Body: UpdateFunctionRequestBody;
    Params: FunctionActionRequestParams;
  }>(
    '/uploadCode/:orid',
    {
      schema: {
        description: 'Update code in a function',
        tags: ['Functions'],
        // TODO: Figure out how to clear the below note so swagger docs are correct
        // body: UpdateFunctionRequestBodySchema, // NOTE: Cannot do body validation here due to file upload stuff
        params: FunctionActionRequestParamsSchema,
        response: {
          201: UpdateFunctionResponseBodySchema,
        },
      },
      preHandler: MULTER_UPLOAD.single('sourceArchive'),
    },
    async (request, response) => {
      let cleanupCallback: (() => void) | undefined;
      try {
        const {
          validationErrors,
          fieldValues,
          cleanupCallback: cb,
        } = getFileUploadAndFormFields(request as FastifyMulterFileRequest, {
          fields: [
            { key: 'runtime', required: true },
            { key: 'entryPoint', required: true },
            { key: 'context' },
          ],
        });

        cleanupCallback = cb;

        if (validationErrors.length > 0) {
          request.log.trace(
            { validationErrors },
            'Request could not be processed due to validation failures',
          );
          response.status(400);
          return response.send(
            validationErrors.map((message) => ({ message })),
          );
        }

        const parsedOrid = oridV1.parse(request.params.orid);
        request.log.trace(
          { fieldValues, parsedOrid },
          'Request has been validated and is ready to process',
        );

        const success = await request.services.logic.updateFunctionCode({
          id: parsedOrid.resourceId,
          accountId: parsedOrid.custom3 as string,
          codePackage: fieldValues.sourcePath as string,
          runtime: fieldValues.runtime as string,
          entryPoint: fieldValues.entryPoint as string,
          context: fieldValues.context as string,
        });
        request.log.trace(
          { success },
          'Function code has been updated, returning response',
        );

        const responsePayload = {
          id: parsedOrid.resourceId,
          orid: oridV1.generate(parsedOrid),
          status: success ? 'buildComplete' : 'buildFailed',
        };

        return response.status(success ? 201 : 400).send(responsePayload);
      } catch (err) {
        request.log.error(err, 'Error updating function code');
        throw err;
      } finally {
        if (cleanupCallback) {
          cleanupCallback();
        }
      }
    },
  );

  app.post<{
    // Body: UpdateFunctionRequestBody;
    Params: FunctionActionRequestParams;
    Querystring: InvokeFunctionQueryParams;
  }>(
    '/invoke/:orid',
    {
      schema: {
        description: 'Invoke a function',
        tags: ['Functions'],
        // TODO: Figure out how to clear the below note so swagger docs are correct
        // body: UpdateFunctionRequestBodySchema, // NOTE: Cannot do body validation here due to file upload stuff
        params: FunctionActionRequestParamsSchema,
        querystring: InvokeFunctionQueryParamsSchema,
        response: {
          201: {
            content: {
              'application/json': {
                schema: {
                  description: 'when user function returns json object',
                  type: 'object',
                },
              },
              'text/plain': {
                schema: {
                  description: 'when user function returns string',
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    async (request, response) => {
      try {
        const parsedOrid = oridV1.parse(request.params.orid);
        const result = await request.services.logic.invokeFunction({
          id: parsedOrid.resourceId,
          accountId: parsedOrid.custom3 as string,
          payload: request.body as string,
          async: request.query.async,
        });

        if (result) {
          return response.status(result.status).send(result.data);
        } else {
          return response.status(202).send({
            message: 'Request accepted.',
          });
        }
      } catch (err) {
        request.log.error(err, 'Error invoking function code');
        throw err;
      }
    },
  );

  app.get<{
    Params: FunctionActionRequestParams;
  }>(
    '/inspect/:orid',
    {
      schema: {
        description: 'Inspect a function',
        tags: ['Functions'],
        params: FunctionActionRequestParamsSchema,
        response: {
          200: InspectFunctionResponseBodySchema,
          404: SWAGGER_NO_CONTENT,
        },
      },
    },
    async (request, response) => {
      try {
        const parsedOrid = oridV1.parse(request.params.orid);
        const result = await request.services.logic.getFunctionDetails({
          id: parsedOrid.resourceId,
          accountId: parsedOrid.custom3 as string,
        });

        if (result) {
          return response.status(200).send({
            id: parsedOrid.resourceId,
            orid: request.params.orid,
            name: result.name,
            runtime: result.runtime,
            entryPoint: result.entryPoint,
            created: result.created,
            lastUpdate: result.lastUpdate,
            lastInvoke: result.lastInvoke,
          });
        } else {
          return response.status(404).send();
        }
      } catch (err) {
        request.log.error(err, 'Error retrieving function details');
        throw err;
      }
    },
  );

  done();
}
