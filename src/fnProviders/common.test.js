/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');
const nock = require('nock');

const common = require('./common');

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

  describe('makeRequest', () => {
    it('GET is successful and returns response', async () => {
      // Arrange
      serviceApi.get('/foo').reply(200, {
        data: 'bar',
      });

      // Act
      const resp = await common.makeRequest(serviceBaseUrl, {
        path: '/foo',
        httpVerb: 'get',
      });

      // Assert
      chai.expect(resp.status).to.be.equal(200);
      chai.expect(resp.data).to.deep.equal({
        data: 'bar',
      });
    });

    it('POST is successful and returns response', async () => {
      // Arrange
      serviceApi.post('/foo').reply(200, {
        data: 'bar',
      });

      // Act
      const resp = await common.makeRequest(serviceBaseUrl, {
        path: '/foo',
        httpVerb: 'post',
        data: { arg1: 1 },
      });

      // Assert
      chai.expect(resp.status).to.be.equal(200);
      chai.expect(resp.data).to.deep.equal({
        data: 'bar',
      });
    });

    it('DELETE is successful and returns response', async () => {
      // Arrange
      serviceApi.delete('/foo').reply(200);

      // Act
      const resp = await common.makeRequest(serviceBaseUrl, {
        path: '/foo',
        httpVerb: 'delete',
        data: { arg1: 1 },
      });

      // Assert
      chai.expect(resp.status).to.be.equal(200);
      chai.expect(resp.data).to.be.equal('');
    });

    it('Request retries and returns response', async () => {
      // Arrange
      serviceApi.get('/foo').reply(500);
      serviceApi.get('/foo').reply(200, {
        data: 'bar',
      });

      // Act
      const resp = await common.makeRequest(serviceBaseUrl, {
        path: '/foo',
        httpVerb: 'get',
      });

      // Assert
      chai.expect(resp.status).to.be.equal(200);
      chai.expect(resp.data).to.deep.equal({
        data: 'bar',
      });
    });

    it('Throws error when unknown http verb provided', async () => {
      // Act
      try {
        await common.makeRequest(serviceBaseUrl, {
          path: '/foo',
          httpVerb: 'does-not-exist',
        });
        throw new Error('Test should of thrown error but did not');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.be.equal('HTTP verb "does-not-exist" not understood.');
      }
    });
  });
});
