const jsonschema = require('jsonschema');
const runtimes = require('../runtimes');

const createRequestSchema = {
  id: '/UploadCodeRequest',
  title: 'UploadCodeRequest',
  description: 'Upload code to a serverless function request schema',
  type: 'object',
  properties: {
    runtime: {
      enum: runtimes.SUPPORTED_RUNTIMES,
    },
    entryPoint: {
      type: 'string',
      description: 'Friendly name of this serverless function',
    },
  },
  required: ['entryPoint', 'runtime'],
  additionalProperties: false,
};

const validate = (data) => {
  const validator = new jsonschema.Validator();
  return validator.validate(data, createRequestSchema);
};

module.exports = {
  validate,
};
