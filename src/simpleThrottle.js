const _ = require('lodash');

const globals = require('./globals');
const helpers = require('./helpers');

const throttleData = {};

// TODO: Update to configurable lock provider and add redis-lock implementation
const acquire = async (key) => {
  const parsedMaxConcurrent = _.parseInt(
    helpers.getEnvVar('MDS_FN_INVOKE_THROTTLE_MAX_CONCURRENT') || '',
  );
  const maxConcurrent = _.isNaN(parsedMaxConcurrent) ? 3 : parsedMaxConcurrent;
  const current = _.get(throttleData, key, 0);

  if (current < maxConcurrent) {
    throttleData[key] = current + 1;
    return Promise.resolve();
  }

  const delayTime = 50 + Math.random() * 100;
  await globals.delay(delayTime);
  return acquire(key);
};

const release = (key) => {
  const current = _.get(throttleData, key, 0);
  throttleData[key] = _.max([current - 1, 0]);
};

module.exports = {
  acquire,
  release,
};
