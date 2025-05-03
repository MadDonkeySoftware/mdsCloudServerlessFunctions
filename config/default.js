module.exports = {
  // The port that the HTTP interface will listen upon for requests
  apiPort: 8888,

  // When true, enables the swagger interface. This should only be enabled for non-production environments.
  enableSwagger: false,

  fastifyOptions: {
    logger: {
      level: 'info',
      mixin: (mergeObject) => ({
        ...mergeObject,
        'event.dataset': 'mdsCloudServerlessFunctions',
      }),
    },
  },

  // MDS SDK configuration
  mdsSdk: {
    identityUrl: undefined,
    account: undefined,
    userId: undefined,
    password: undefined,
  },

  mongo: {
    url: 'mongodb://localhost:27017',
    db: 'mdsCloudServerlessFunctions',
  },

  // The provider element for all ORIDs created or consumed. Used in the validation process.
  oridProviderKey: 'orid',

  providerConfig: {
    version: '1.0',
    runtimeMap: {
      node: 'mds',
      python: 'mds',
    },
    providers: {
      mds: {
        type: 'mdsCloud',
        baseUrl: 'http://localhost:8888',
      },
    },
  },
};
