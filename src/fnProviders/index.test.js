/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');

const fnProvider = require('./index');
const fnProjectProvider = require('./fnProject');

describe('src/fnProviders', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns undefined provider when undefined runtime', () => {
    chai.expect(fnProvider.getProviderForRuntime()).to.be.undefined;
  });

  it('throws error when unknown runtime', () => {
    chai.expect(() => fnProvider.getProviderForRuntime('Terrible'))
      .to.throw('Runtime "Terrible" not understood.');
  });

  describe('Valid provider', () => {
    it('NAME attribute is provider implementation value', () => {
      // Arrange
      const provider = fnProvider.getProviderForRuntime('node');

      // Act / Assert
      chai.expect(provider.NAME).to.equal(fnProjectProvider.NAME);
    });
  });
});
