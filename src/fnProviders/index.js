/* NOTICE
The intent of this module is to provide forward compatibility for operators to determine what
runtimes will be serviced by which FaaS providers. Once that purpose is clear and has been
implemented this notice can be removed.
*/

// TODO: Move this into a lib that can be shared between mdsCloudServerlessFunctions
//   and the various minions
const _ = require('lodash');

const globals = require('../globals');
const configLoader = require('../configLoader');
const MdsCloudProvider = require('./mdsCloud');

// const mappedAttributes = [
//   'NAME',
//   'createFunction',
//   'updateFunction',
//   'invokeFunction',
//   'deleteFunction',
// ];

// /* Required Methods:
//  * Create Function
//  * Build Function
//  * Execute Function
//  * Delete Function
//  */

// const mapProvider = (provider) => {
//   const obj = {};
//   _.map(mappedAttributes, (e) => { obj[e] = provider[e]; });
//   return obj;
// };

/**
 * @typedef {object} Provider
 *
 * @property {function} createFunction
 * @property {function} updateFunction
 * @property {function} invokeFunction
 * @property {function} deleteFunction
 */

/**
 *
 * @param {string} runtime The runtime being used
 * @returns {Promise<Provider>}
 */
const getProviderForRuntime = async (runtime) => {
  if (runtime === undefined) return undefined;
  const providerConfig = await configLoader.getProviderConfigForRuntime(
    runtime,
  );
  const providerType = _.get(providerConfig, ['type'], '');

  switch (providerType.toUpperCase()) {
    case 'MDSCLOUD': {
      const logger = globals.getLogger();
      logger.debug({ providerConfig }, 'Initializing new mdsCloudProvider');
      return new MdsCloudProvider(providerConfig.baseUrl);
    }
    default:
      throw new Error(
        `Runtime "${runtime}" for provider "${providerType}" configured improperly or not understood.`,
      );
  }
};

module.exports = {
  getProviderForRuntime,
};
