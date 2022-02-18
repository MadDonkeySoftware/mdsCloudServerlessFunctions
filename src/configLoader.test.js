/* eslint-disable no-unused-expressions */

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');

const configLoader = require('./configLoader');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
    configLoader.clearConfigObject();
  });

  it('Default state of cachedConfigObject is null', () => {
    chai.expect(configLoader.cachedConfigObject).to.be.null;
  });

  describe('clearConfigObject', () => {
    it('When run cachedConfigObject becomes null', () => {
      // Arrange
      configLoader.cachedConfigObject = {};

      // Act
      configLoader.clearConfigObject();

      // Assert
      chai.expect(configLoader.cachedConfigObject).to.be.null;
    });
  });

  describe('readConfigFile', () => {});

  describe('getVersion', () => {});

  describe('isValidConfig', () => {
    _.map(
      [
        ['1', false, 'Invalid single digit version'],
        ['1.0.0', false, 'Invalid tri-digit version'],
        ['a', false, 'Invalid non-digit single digit version'],
        ['a.b.c', false, 'Invalid non-digit tri-digit version'],
        ['1.0', true, 'Valid two digit version'],
      ],
      ([version, expected, description]) => {
        it(description, () => {
          // Arrange
          const fake = {
            version,
          };

          // Act
          const result = configLoader.isValidConfig(fake);

          // Assert
          chai.expect(result).to.equal(expected);
        });
      },
    );
  });

  describe('getConfigObject', () => {
    afterEach(() => {
      configLoader.clearConfigObject();
    });

    it('When no cached config exists reads the config file', async () => {
      // Arrange
      const expectedConfig = {
        version: '1.0',
      };
      sinon
        .stub(configLoader, 'readConfigFile')
        .resolves(JSON.stringify(expectedConfig));

      // Act
      const result = await configLoader.getConfigObject();

      // Assert
      chai.expect(result).to.deep.equal(expectedConfig);
      chai.expect(configLoader.readConfigFile.callCount).to.be.equal(1);
    });

    it('When cached config exists uses the cached version', async () => {
      // Arrange
      const expectedConfig = {
        version: '1.0',
      };
      configLoader.cachedConfigObject = expectedConfig;
      sinon
        .stub(configLoader, 'readConfigFile')
        .rejects(new Error('Test not using cached config'));

      // Act
      const result = await configLoader.getConfigObject();

      // Assert
      chai.expect(result).to.deep.equal(expectedConfig);
    });
  });

  describe('getConfiguredRuntimes', () => {
    it('with valid config will resolve expected runtime list', async () => {
      // Arrange
      const expectedConfig = {
        version: '1.0',
        runtimeMap: {
          node: 'mds',
          python: 'mds',
        },
        providers: {
          mds: {
            type: 'mdsCloud',
            baseUrl: 'http://127.0.0.1:8888',
          },
        },
      };
      configLoader.cachedConfigObject = expectedConfig;

      // Act
      const result = await configLoader.getConfiguredRuntimes();

      // Assert
      chai.expect(result).to.deep.equal(['node', 'python']);
    });

    it('When no configuration present resolves empty list', async () => {
      // Arrange
      sinon.stub(configLoader, 'getConfigObject').resolves(undefined);

      // Act
      const result = await configLoader.getConfiguredRuntimes();

      // Assert
      chai.expect(result).to.deep.equal([]);
    });

    it('with invalid version will resolve empty list', async () => {
      // Arrange
      const expectedConfig = {
        runtimeMap: {
          node: 'mds',
          python: 'mds',
        },
        providers: {
          mds: {
            type: 'mdsCloud',
            baseUrl: 'http://127.0.0.1:8888',
          },
        },
      };
      sinon.stub(configLoader, 'getConfigObject').resolves(expectedConfig);

      // Act
      const result = await configLoader.getConfiguredRuntimes();

      // Assert
      chai.expect(result).to.deep.equal([]);
    });
  });

  describe('getProviderConfigForRuntime', () => {
    it('', async () => {
      // Arrange
      const expectedConfig = {
        version: '1.0',
        runtimeMap: {
          node: 'mds',
        },
        providers: {
          mds: {
            type: 'mdsCloud',
            baseUrl: 'http://127.0.0.1:8888',
          },
        },
      };
      sinon.stub(configLoader, 'getConfigObject').resolves(expectedConfig);

      // Act
      const result = await configLoader.getProviderConfigForRuntime('node');

      // Assert
      chai.expect(result).to.deep.equal({
        type: 'mdsCloud',
        baseUrl: 'http://127.0.0.1:8888',
      });
    });
  });
});
