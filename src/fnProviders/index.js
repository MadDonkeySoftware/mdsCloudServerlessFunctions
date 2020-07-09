/* NOTICE
The intent of this module is to provide forward compatibility for operators to determine what
runtimes will be serviced by which FaaS providers. Once that purpose is clear and has been
implemented this notice can be removed.
*/

// TODO: Move this into a lib that can be shared between mdsCloudServerlessFunctions
//   and the various minions
const _ = require('lodash');
const fnProject = require('./fnProject');

const mappedAttributes = [
  'NAME',
  'findAppIdByName',
  'createApp',
  'createFunction',
  'updateFunction',
  'deleteFunction',
];

const buildAppName = ({ account }) => `mdsFn-${account}`;

const mapProvider = (provider) => {
  const obj = {
    buildAppName,
  };
  _.map(mappedAttributes, (e) => { obj[e] = provider[e]; });
  return obj;
};

/**
 * @typedef {object} Provider
 *
 * @property {function} hasApp
 * @property {function} createApp
 * @property {function} buildAppName
 * @property {function} createFunction
 * @property {function} updateFunction
 * @property {function} deleteFunction
 */

/**
 *
 * @param {string} runtime The runtime being used
 * @returns {Provider}
 */
const getProviderForRuntime = (runtime) => {
  if (runtime === undefined) return undefined;

  switch (runtime.toUpperCase()) {
    case 'NODE':
      return mapProvider(fnProject);
    default:
      throw new Error(`Runtime "${runtime}" not understood.`);
  }
};

module.exports = {
  getProviderForRuntime,
};
