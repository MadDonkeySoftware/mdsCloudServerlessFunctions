const _ = require('lodash');

const SUPPORTED_RUNTIMES = [
  'node',
];

/**
 *
 * @param {Array<string>} data The runtimes to reduce
 * @returns{Array<string>}
 */
const reduce = (data) => {
  const comparer = (a, b) => a.toUpperCase() === b.toUpperCase();
  return _.intersectionWith(SUPPORTED_RUNTIMES, data, comparer);
};

module.exports = {
  SUPPORTED_RUNTIMES,
  reduce,
};
