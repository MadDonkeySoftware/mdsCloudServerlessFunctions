import { rm } from 'fs/promises';
import { type FastifyMulterFileRequest } from '../types/fastify-multer-file';

export function getFileUploadAndFormFields(
  request: FastifyMulterFileRequest,
  {
    fields,
  }: {
    fields: { key: string; required?: boolean }[];
  },
) {
  request.log.trace({ fields }, 'Obtaining file upload and form fields');
  const validationErrors: string[] = [];
  const fieldValues: Record<string, unknown> = {};

  const formFields = request.body as Record<string, unknown>;

  const requestFiles: string[] = [request.file.path];
  fieldValues.sourcePath = request.file.path;

  for (const field of fields) {
    const fieldValue = formFields[field.key];
    if (!fieldValue && field.required) {
      validationErrors.push(`${field.key} missing from payload`);
    } else {
      fieldValues[field.key] = fieldValue;
    }
  }

  request.log.trace(
    // { fieldValues, requestFiles, validationErrors },
    { fieldValues, validationErrors },
    'Returning parsed form fields and file paths',
  );
  return {
    validationErrors,
    fieldValues,
    cleanupCallback: async () => {
      const logger = request.log;
      logger.trace({ requestFiles }, 'Cleaning up uploaded files');
      const tasks = requestFiles.map((file) => rm(file));
      const results = await Promise.allSettled(tasks);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(
            { file: requestFiles[index], error: result.reason },
            'Error cleaning up file',
          );
        }
      });
      logger.trace({ requestFiles }, 'File cleanup complete');
    },
  };
}
