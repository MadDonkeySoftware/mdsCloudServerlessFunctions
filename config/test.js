module.exports = {
  fastifyOptions: {
    logger: {
      level: 'fatal',
    },
  },

  // The provider element for all ORIDs created or consumed. USed int he validation process.
  oridProviderKey: 'testIssuer',

  redisUrl: 'redis://localhost:6379',
};
