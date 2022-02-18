/* eslint-disable no-unused-expressions */
const chai = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const handlerHelpers = require('./handler-helpers');

describe('globals', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getIssuer', () => {
    it('Matches environment variable ORID_PROVIDER_KEY', () => {
      chai
        .expect(handlerHelpers.getIssuer())
        .to.equal(process.env.ORID_PROVIDER_KEY);
    });
  });

  describe('getAppPublicSignature', () => {
    it('Multiple calls call MDS_IDENTITY_URL once and returns the available signature', () => {
      // Arrange
      const previousMdsIdentityUrl = process.env.MDS_IDENTITY_URL;
      process.env.MDS_IDENTITY_URL = 'http://127.0.0.1:1234';
      const url = `${process.env.MDS_IDENTITY_URL}/v1/publicSignature`;
      const getStub = sinon.stub(axios, 'get');
      getStub
        .withArgs(url)
        .resolves({ data: { signature: 'public-signature' } });

      // Act
      return handlerHelpers
        .getAppPublicSignature()
        .then((signature) => {
          // Assert
          chai.expect(signature).to.be.equal('public-signature');
          return handlerHelpers.getAppPublicSignature();
        })
        .then((signature) => {
          // Assert
          chai.expect(signature).to.be.equal('public-signature');
        })
        .finally(() => {
          // Assert
          process.env.MDS_IDENTITY_URL = previousMdsIdentityUrl;
          chai.expect(getStub.callCount).to.be.equal(1);
        });
    });
  });

  describe('sendResponse', () => {
    it('sends 200 when only response provided', () => {
      // Arrange
      const resp = {
        status: sinon.stub(),
        send: sinon.stub(),
      };

      // Act
      return handlerHelpers.sendResponse(resp).then(() => {
        // Assert
        chai.expect(resp.status.callCount).to.equal(1);
        chai.expect(resp.status.getCalls()[0].args).to.deep.equal([200]);
        chai.expect(resp.send.callCount).to.equal(1);
        chai.expect(resp.send.getCalls()[0].args).to.deep.equal([undefined]);
      });
    });

    it('sends specified body and code when provided', () => {
      // Arrange
      const resp = {
        status: sinon.stub(),
        send: sinon.stub(),
      };

      // Act
      return handlerHelpers
        .sendResponse(resp, 400, 'Bad Request Test')
        .then(() => {
          // Assert
          chai.expect(resp.status.callCount).to.equal(1);
          chai.expect(resp.status.getCalls()[0].args).to.deep.equal([400]);
          chai.expect(resp.send.callCount).to.equal(1);
          chai
            .expect(resp.send.getCalls()[0].args)
            .to.deep.equal(['Bad Request Test']);
        });
    });
  });

  describe('recombineUrlParts', () => {
    it('appends all numbered url parts to the part matching the provided key', () => {
      // Arrange
      const params = {
        foo: 'thing',
        0: '/a',
        1: '/b',
        2: '/c',
      };

      // Act
      const result = handlerHelpers.recombineUrlParts(params, 'foo');

      // Assert
      chai.expect(result).to.equal('thing/a/b/c');
    });
  });

  describe('getOridFromRequest', () => {
    it('Invalid Orid', () => {
      // Arrange
      const params = {
        foo: 'thing',
        0: '/a',
        1: '/b',
        2: '/c',
      };

      // Act
      const result = handlerHelpers.getOridFromRequest({ params });

      // Assert
      chai.expect(result).to.be.undefined;
    });

    it('Valid Orid', () => {
      // Arrange
      const params = {
        foo: 'orid:1:provider:c1:c2:c3:bar:thing',
        0: '/a',
        1: '/b',
        2: '/c',
      };

      // Act
      const result = handlerHelpers.getOridFromRequest({ params }, 'foo');

      // Assert
      chai.expect(result).to.deep.equal({
        provider: 'provider',
        custom1: 'c1',
        custom2: 'c2',
        custom3: 'c3',
        resourceId: 'thing',
        resourceRider: 'a/b/c',
        service: 'bar',
      });
    });
  });

  describe('validateToken', () => {
    it('from valid issuer sets parsedToken on request', () => {
      // Arrange
      const req = {
        headers: {
          token: 'validToken',
        },
      };
      const resp = {};
      const parsedToken = {
        payload: {
          iss: 'testIssuer',
        },
      };
      const stubLogger = {
        debug: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon.stub(handlerHelpers, 'getAppPublicSignature').resolves('pubSig');
      sinon.stub(handlerHelpers, 'getIssuer').returns('testIssuer');
      sinon.stub(jwt, 'verify').returns(parsedToken);

      // Act
      return handlerHelpers
        .validateToken(stubLogger)(req, resp, Promise.resolve.bind(Promise))
        .then(() => {
          // Assert
          chai.expect(req.parsedToken).to.equal(parsedToken);
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(0);
        });
    });

    it('from invalid issuer sets parsedToken on request', () => {
      // Arrange
      const req = {
        headers: {
          token: 'validToken',
        },
      };
      const resp = {};
      const parsedToken = {
        payload: {
          iss: 'testIssuer',
        },
      };
      const stubLogger = {
        debug: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon.stub(handlerHelpers, 'getAppPublicSignature').resolves('pubSig');
      sinon.stub(handlerHelpers, 'getIssuer').returns('fred');
      sinon.stub(jwt, 'verify').returns(parsedToken);

      // Act
      return handlerHelpers
        .validateToken(stubLogger)(req, resp, Promise.resolve.bind(Promise))
        .then(() => {
          // Assert
          chai.expect(req.parsedToken).to.equal(undefined);
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(1);
          chai
            .expect(handlerHelpers.sendResponse.getCalls()[0].args)
            .to.deep.equal([resp, 403]);
        });
    });

    it('Returns 403 when error occurs validating token', () => {
      // Arrange
      const req = {
        headers: {
          token: 'validToken',
        },
      };
      const resp = {};
      const stubLogger = {
        debug: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon
        .stub(handlerHelpers, 'getAppPublicSignature')
        .throws(new Error('test error'));

      // Act
      return handlerHelpers
        .validateToken(stubLogger)(req, resp, Promise.resolve.bind(Promise))
        .then(() => {
          // Assert
          chai.expect(req.parsedToken).to.equal(undefined);
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(1);
          chai
            .expect(handlerHelpers.sendResponse.getCalls()[0].args)
            .to.deep.equal([resp, 403]);
        });
    });
  });

  describe('ensureRequestOrid', () => {
    it('valid orid', () => {
      // Arrange
      const req = {
        params: {
          orid: 'orid:1::::1001:ts:foo',
          0: '/bar',
        },
      };
      const resp = {
        setHeader: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon
        .stub(handlerHelpers, 'getAppPublicSignature')
        .throws(new Error('test error'));

      // Act
      return handlerHelpers
        .ensureRequestOrid(true, 'orid')(
          req,
          resp,
          Promise.resolve.bind(Promise),
        )
        .then(() => {
          // Assert
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(0);
          chai.expect(resp.setHeader.callCount).to.equal(0);
        });
    });

    it('invalid orid', () => {
      // Arrange
      const req = {
        params: {
          orid: 'foo',
          0: '/bar',
        },
      };
      const resp = {
        setHeader: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon
        .stub(handlerHelpers, 'getAppPublicSignature')
        .throws(new Error('test error'));

      // Act
      return handlerHelpers
        .ensureRequestOrid(true, 'orid')(
          req,
          resp,
          Promise.resolve.bind(Promise),
        )
        .then(() => {
          // Assert
          chai.expect(resp.setHeader.callCount).to.equal(1);
          chai
            .expect(resp.setHeader.getCalls()[0].args)
            .to.deep.equal(['content-type', 'text/plain']);
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(1);
          chai
            .expect(handlerHelpers.sendResponse.getCalls()[0].args)
            .to.deep.equal([resp, 400, 'resource not understood']);
        });
    });
  });

  describe('canAccessResource', () => {
    it('Valid orid returned and custom3 matches token account', () => {
      // Arrange
      const req = {
        parsedToken: {
          payload: {
            accountId: '1001',
          },
        },
      };
      const orid = {
        provider: 'provider',
        custom1: '',
        custom2: '',
        custom3: '1001',
        resourceId: 'thing',
        resourceRider: 'a/b/c',
        service: 'bar',
      };
      const resp = {
        setHeader: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon.stub(handlerHelpers, 'getOridFromRequest').returns(orid);

      // Act
      return handlerHelpers
        .canAccessResource('orid')(req, resp, Promise.resolve.bind(Promise))
        .then(() => {
          // Assert
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(0);
          chai.expect(resp.setHeader.callCount).to.equal(0);
        });
    });

    it('Valid orid returned and custom3 does not match token account', () => {
      // Arrange
      const req = {
        parsedToken: {
          payload: {
            accountId: '1003',
          },
        },
      };
      const orid = {
        provider: 'provider',
        custom1: '',
        custom2: '',
        custom3: '1001',
        resourceId: 'thing',
        resourceRider: 'a/b/c',
        service: 'bar',
      };
      const resp = {
        setHeader: sinon.stub(),
      };
      const logger = {
        debug: sinon.stub(),
      };
      sinon.stub(handlerHelpers, 'sendResponse').resolves();
      sinon.stub(handlerHelpers, 'getOridFromRequest').returns(orid);

      // Act
      return handlerHelpers
        .canAccessResource({ orid: 'orid', logger })(
          req,
          resp,
          Promise.resolve.bind(Promise),
        )
        .then(() => {
          // Assert
          chai.expect(logger.debug.callCount).to.equal(1);
          chai
            .expect(logger.debug.getCalls()[0].args)
            .to.deep.equal([
              { requestAccount: '1001', tokenAccountId: '1003' },
              'Insufficient privilege for request',
            ]);
          chai.expect(handlerHelpers.sendResponse.callCount).to.equal(1);
          chai
            .expect(handlerHelpers.sendResponse.getCalls()[0].args)
            .to.deep.equal([resp, 403]);
        });
    });
  });
});
