/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');
const globals = require('./globals');
const helpers = require('./helpers');

const simpleThrottle = require('./simpleThrottle');

describe('src/simpleThrottle', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('acquire / delay', () => {
    describe('functions as expected', () => {
      it('Uses 3 for default max concurrent', () => {
        // Arrange
        const testKey = 'test';
        const delay = (timeout) => new Promise(
          (resolve) => setTimeout(resolve, timeout),
        );

        sinon.stub(globals, 'delay').callsFake(() => delay(1));
        const data = [];
        simpleThrottle.acquire(testKey).then(() => data.push(1));
        simpleThrottle.acquire(testKey).then(() => data.push(2));
        simpleThrottle.acquire(testKey).then(() => data.push(3));
        simpleThrottle.acquire(testKey).then(() => data.push(4));

        // Act
        return delay(10).then(() => {
          data.push('release');
          simpleThrottle.release(testKey);
          return delay(10);
        }).then(() => {
          simpleThrottle.release(testKey);
          simpleThrottle.release(testKey);
          simpleThrottle.release(testKey);
          return delay(10);
        }).then(() => {
          chai.expect(data).to.deep.equal([
            1,
            2,
            3,
            'release',
            4,
          ]);
        });
      });

      it('', () => {
        // Arrange
        const testKey = 'test';
        const delay = (timeout) => new Promise(
          (resolve) => setTimeout(resolve, timeout),
        );

        sinon.stub(globals, 'delay').callsFake(() => delay(1));
        sinon.stub(helpers, 'getEnvVar').returns('2');
        const data = [];
        simpleThrottle.acquire(testKey).then(() => data.push(1));
        simpleThrottle.acquire(testKey).then(() => data.push(2));
        simpleThrottle.acquire(testKey).then(() => data.push(3));

        // Act
        return delay(10).then(() => {
          data.push('release');
          simpleThrottle.release(testKey);
          return delay(10);
        }).then(() => {
          simpleThrottle.release(testKey);
          simpleThrottle.release(testKey);
          simpleThrottle.release(testKey);
          return delay(10);
        }).then(() => {
          chai.expect(data).to.deep.equal([
            1,
            2,
            'release',
            3,
          ]);
        });
      });
    });
  });
});
