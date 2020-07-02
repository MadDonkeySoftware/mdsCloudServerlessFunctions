const supertest = require('supertest');
const chai = require('chai');

const src = require('..');

describe('src/handlers/index', () => {
  it('provides the root url', () => {
    // Arrange
    const app = src.buildApp();

    // Act / Assert
    return supertest(app)
      .get('/sample/fooBar')
      .expect('content-type', /application\/json/)
      .expect(200)
      .then((resp) => {
        const body = JSON.parse(resp.text);

        delete body.ts; // removed due to no value added and difficulty to test

        chai.expect(body).to.eql({
          message: {},
          topic: 'fooBar',
        });
      });
  });
});
