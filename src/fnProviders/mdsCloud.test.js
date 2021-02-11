/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const fs = require('fs');

const globals = require('../globals');
const helpers = require('../helpers');
const MdsCloudProvider = require('./mdsCloud');

describe(__filename, () => {
  const serviceBaseUrl = 'http://127.0.0.1';
  let serviceApi;

  beforeEach(() => {
    serviceApi = nock(serviceBaseUrl);
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  it('constructor properly configures object', () => {
    // Arrange
    sinon.stub(helpers, 'getEnvVar')
      .withArgs('MDS_IDENTITY_URL')
      .returns('http://127.0.0.1:8888')
      .withArgs('MDS_FN_SYS_USER')
      .returns('test-user')
      .withArgs('MDS_FN_SYS_PASSWORD')
      .returns('test-user-pwd')
      .withArgs('MDS_FN_SYS_ACCOUNT')
      .returns('test-acct')
      .withArgs('MDS_FN_SYS_ALLOW_SELFSIGN_CERT')
      .returns('true');

    // Act
    const obj = new MdsCloudProvider(serviceBaseUrl);

    // Assert
    chai.expect(obj.baseUrl).to.be.equal(serviceBaseUrl);
    chai.expect(obj.authManager.account).to.be.equal('test-acct');
    chai.expect(obj.authManager.allowSelfSignCert).to.be.equal(true);
    chai.expect(obj.authManager.identityUrl).to.be.equal('http://127.0.0.1:8888');
    chai.expect(obj.authManager.password).to.be.equal('test-user-pwd');
    chai.expect(obj.authManager.userId).to.be.equal('test-user');
  });

  const getProviderWithFakedAuthManager = () => {
    const provider = new MdsCloudProvider(serviceBaseUrl);
    provider.authManager = {
      getAuthenticationToken: () => Promise.resolve('test-auth-token'),
    };

    return provider;
  };

  describe('createFunction', () => {
    it('when successful creates the function and returns the unique id', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/createFunction').reply(201, {
        id: 'new-func-id',
      });

      // Act
      const resp = await service.createFunction('test-func', 'acct-1234');

      // Assert
      chai.expect(resp).to.be.equal('new-func-id');
    });

    it('when unsuccessful logs the response and returns undefined', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/createFunction').reply(400, { message: 'test failure' });
      const fakeLogger = {
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);

      // Act
      const resp = await service.createFunction('test-func', 'acct-1234');

      // Assert
      chai.expect(resp).to.be.undefined;
      chai.expect(fakeLogger.warn.getCall(0).args).to.deep.equal([
        { status: 400, response: { message: 'test failure' } },
        'Failed to create MDSCloud function.',
      ]);
    });
  });

  describe('updateFunction', () => {
    it('when successful creates the function and returns the unique id', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/buildFunction').reply(200, {
        id: 'new-func-id',
      });
      sinon.stub(fs, 'createReadStream').returns('abc');

      // Act
      const resp = await service.updateFunction('func-id', '/some/path', 'node', 'src/index:bar');

      // Assert
      chai.expect(resp).to.be.equal(true);
    });

    it('when unsuccessful logs the response and returns undefined', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/buildFunction').reply(400, { message: 'test failure' });
      sinon.stub(fs, 'createReadStream').returns('abc');
      const fakeLogger = {
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);

      // Act
      const resp = await service.updateFunction('func-id', '/some/path', 'node', 'src/index:bar');

      // Assert
      chai.expect(resp).to.be.equal(false);
      chai.expect(fakeLogger.warn.getCall(0).args).to.deep.equal([
        { status: 400, response: { message: 'test failure' } },
        'Failed to update MDSCloud function.',
      ]);
    });
  });

  describe('invokeFunction', () => {
    it('when called correctly calls provider then returns result', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/executeFunction/func-id').reply(200, {
        foo: 'bar',
      });
      sinon.stub(fs, 'createReadStream').returns('abc');

      // Act
      const resp = await service.invokeFunction('func-id', { data: 'test' });

      // Assert
      chai.expect(resp).to.deep.equal({
        status: 200,
        data: { foo: 'bar' },
      });
    });

    it('when unsuccessful logs the response and returns undefined', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.post('/v1/executeFunction/func-id').reply(400, { message: 'test failure' });
      sinon.stub(fs, 'createReadStream').returns('abc');
      const fakeLogger = {
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);

      // Act
      const resp = await service.invokeFunction('func-id', { data: 'test' });

      // Assert
      chai.expect(resp).to.be.undefined;
      chai.expect(fakeLogger.warn.getCall(0).args).to.deep.equal([
        { status: 400, response: { message: 'test failure' } },
        'Failed to invoke MDSCloud function.',
      ]);
    });
  });

  describe('deleteFunction', () => {
    it('when delete succeeds true is returned', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.delete('/v1/func-id').reply(200);
      sinon.stub(fs, 'createReadStream').returns('abc');

      // Act
      const resp = await service.deleteFunction('func-id');

      // Assert
      chai.expect(resp).to.be.equal(true);
    });

    it('when delete unsuccessful logs the response and returns false', async () => {
      // Arrange
      const service = getProviderWithFakedAuthManager();
      serviceApi.delete('/v1/func-id').reply(400, { message: 'test failure' });
      const fakeLogger = {
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);

      // Act
      const resp = await service.deleteFunction('func-id');

      // Assert
      chai.expect(resp).to.be.equal(false);
      chai.expect(fakeLogger.warn.getCall(0).args).to.deep.equal([
        { functionId: 'func-id', status: 400, response: { message: 'test failure' } },
        'Failed to delete MDSCloud function.',
      ]);
    });
  });
});
