/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');
const nock = require('nock');

const globals = require('../globals');
// const helpers = require('../helpers');
const fnProvider = require('./index');

describe.skip('src/fnProviders', () => {
  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  describe('Node provider', () => {
    const provider = fnProvider.getProviderForRuntime('node');

    it('generates expected account name', () => {
      // Act
      const appName = provider.buildAppName({ account: 'testAccount' });

      // Assert
      chai.expect(appName).to.equal('mdsFn-testAccount');
    });

    describe('findAppIdByName', () => {
      /** @type {nock.Scope} */
      let api;

      beforeEach(() => {
        sinon.stub(globals, 'delay').resolves();
        api = nock('http://127.0.0.1:8080');
      });

      it('Handles fetching multiple pages of data and errors gracefully', () => {
        // Arrange
        api.get('/v2/apps').reply(200, {
          items: [
            { id: 1, name: 'test1' },
            { id: 2, name: 'test2' },
          ],
          next_cursor: 'abcd',
        });
        api.get('/v2/apps?cursor=abcd').reply(500);
        api.get('/v2/apps?cursor=abcd').reply(200, {
          items: [
            { id: 3, name: 'test3' },
            { id: 4, name: 'findMe' },
          ],
        });

        // Act
        return provider.findAppIdByName('findMe').then((id) => {
          // Assert
          chai.expect(id).to.equal(4);
        });
      });

      it('after three retries throws error', () => {
        // Arrange
        api.get('/v2/apps').reply(300);
        api.get('/v2/apps').reply(300);
        api.get('/v2/apps').reply(300);
        api.get('/v2/apps').reply(300);

        // Act
        return provider.findAppIdByName('findMe').then(() => {
          chai.expect(true).to.equal(false, 'Test passed when it should error.');
        }).catch((err) => {
          // Assert
          chai.expect(err.message).to.equal('Could not get application list from provider');
        });
      });
    });

    describe('createApp', () => {
      /** @type {nock.Scope} */
      let api;

      beforeEach(() => {
        sinon.stub(globals, 'delay').resolves();
        api = nock('http://127.0.0.1:8080');
      });

      it('when post succeeds responds with data object', () => {
        // Arrange
        api.post('/v2/apps', { name: 'testApp' }).reply(200, { id: 1 });

        // Act
        return provider.createApp('testApp').then((id) => {
          // Assert
          chai.expect(id).to.be.equal(1);
        });
      });

      it('when post fails with conflict return id from app list', () => {
        // Arrange
        api.post('/v2/apps', { name: 'testApp' }).reply(409, { message: 'conflict' });
        api.get('/v2/apps').reply(200, {
          items: [
            { id: 1, name: 'testApp' },
          ],
        });

        // Act
        return provider.createApp('testApp').then((id) => {
          // Assert
          chai.expect(id).to.be.equal(1);
        });
      });

      it('when post fails repeatedly responds undefined', () => {
        // Arrange
        api.post('/v2/apps', { name: 'testApp' }).reply(500);
        api.post('/v2/apps', { name: 'testApp' }).reply(500);
        api.post('/v2/apps', { name: 'testApp' }).reply(500);

        // Act
        return provider.createApp('testApp').then((data) => {
          // Assert
          chai.expect(data).to.be.undefined;
        });
      });
    });

    describe('deleteFunction', () => {
      /** @type {nock.Scope} */
      let api;

      beforeEach(() => {
        sinon.stub(globals, 'delay').resolves();
        api = nock('http://127.0.0.1:8080');
      });

      it('returns true when delete succeeds', () => {
        // Arrange
        api.delete('/v2/fns/testId').reply(204);

        // Act
        return provider.deleteFunction('testId').then((retVal) => {
          // Assert
          chai.expect(retVal).to.be.true;
        });
      });

      it('returns false when delete fails', () => {
        // Arrange
        api.delete('/v2/fns/testId').reply(500);
        api.delete('/v2/fns/testId').reply(500);
        api.delete('/v2/fns/testId').reply(500);

        // Act
        return provider.deleteFunction('testId').then((retVal) => {
          // Assert
          chai.expect(retVal).to.be.false;
        });
      });
    });
  });
});
