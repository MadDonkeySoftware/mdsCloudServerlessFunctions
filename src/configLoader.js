const _ = require('lodash');
const fs = require('fs');
const util = require('util');

const v1Parser = {
  getConfiguredRuntimes: (configObj) => _.keys(_.get(configObj, ['runtimeMap'])),

  getProviderConfigForRuntime: (confObj, runtime) => _.get(
    confObj,
    [
      'providers',
      _.get(confObj, ['runtimeMap', runtime]),
    ],
  ),
};

const parserMap = {
  1: v1Parser,
};

const self = {
  cachedConfigObject: null,

  clearConfigObject: () => {
    self.cachedConfigObject = null;
  },

  readConfigFile: async (path) => {
    const readFile = util.promisify(fs.readFile);
    const configPath = path || _.get(process.env, ['MDS_FN_PROVIDER_CONFIG']);
    const configBody = configPath
      ? (await readFile(configPath)).toString()
      : undefined;
    return configBody;
  },

  getVersion: (configObj) => {
    const version = _.get(configObj, ['version']);

    const isMajorMinorFormat = /^(\d+).(\d+)$/;
    if (!isMajorMinorFormat.test(version)) {
      return undefined;
    }

    // Exec result is [entire match, group1, ...]. Slice removes the first match
    const [major, minor] = isMajorMinorFormat.exec(version).slice(1);
    return { major, minor };
  },

  isValidConfig: (configObj) => {
    const version = self.getVersion(configObj);
    if (!version) {
      return false;
    }

    // TODO: Use Joi or something similar to validate the config

    const parser = parserMap[version.major];
    return !!parser;
  },

  getConfigObject: async () => {
    if (self.cachedConfigObject) {
      return self.cachedConfigObject;
    }

    const configBody = await self.readConfigFile();
    let configObject;
    try {
      configObject = configBody
        ? JSON.parse(configBody)
        : undefined;
    } catch (err) {
      // We don't care.
    }

    if (self.isValidConfig(configObject)) {
      self.cachedConfigObject = configObject;
      return configObject;
    }
    return undefined;
  },

  getConfiguredRuntimes: async () => {
    const conf = await self.getConfigObject();
    if (!conf) {
      return [];
    }

    const version = self.getVersion(conf);
    if (!version) {
      return [];
    }

    const parser = parserMap[version.major];
    return parser.getConfiguredRuntimes(conf);
  },

  getProviderConfigForRuntime: async (runtime) => {
    const conf = await self.getConfigObject();
    const version = self.getVersion(conf);
    if (!version) {
      return undefined;
    }

    const parser = parserMap[version.major];
    return parser.getProviderConfigForRuntime(conf, runtime);
  },
};

module.exports = self;
