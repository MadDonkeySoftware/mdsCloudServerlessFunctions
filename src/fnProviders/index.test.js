/* eslint-disable no-unused-expressions */

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');

const fnProvider = require('./index');
const configLoader = require('../configLoader');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns undefined provider when undefined runtime', async () => {
    chai.expect(await fnProvider.getProviderForRuntime()).to.be.undefined;
  });

  it('throws error when unknown runtime', async () => {
    try {
      await fnProvider.getProviderForRuntime('terrible');
      throw new Error('Test should of throw error but did not.');
    } catch (err) {
      chai.expect(err.message).to.be.equal(
        'Runtime "terrible" for provider "" configured improperly or not understood.',
      );
    }
  });

  _.map([['mdsCloud']], ([providerType]) => {
    it(`returns properly configured ${providerType} provider for runtime`, async () => {
      // Arrange
      sinon.stub(configLoader, 'getProviderConfigForRuntime')
        .resolves({
          type: providerType,
        });

      // Act
      const result = await fnProvider.getProviderForRuntime('node');

      // Assert
      chai.expect(result).to.exist;
    });
  });
});
