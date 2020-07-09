const jsonschema = require('jsonschema');

const createRequestSchema = {
  id: '/CreateRequest',
  title: 'CreateRequest',
  description: 'Create new serverless function request schema',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Friendly name of this serverless function',
    },
  },
  required: ['name'],
  additionalProperties: false,
};

const validate = (data) => {
  const validator = new jsonschema.Validator();
  return validator.validate(data, createRequestSchema);
};

module.exports = {
  validate,
};
