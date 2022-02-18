/* eslint-disable no-unused-expressions */
const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');
const jwt = require('jsonwebtoken');

const src = require('../..');
const repo = require('../../repo');
const fnProvider = require('../../fnProviders');
const handlerHelpers = require('../handler-helpers');

describe(__filename, () => {
  const app = src.buildApp();

  beforeEach(() => {
    sinon.stub(handlerHelpers, 'getIssuer').returns('testIssuer');
    sinon
      .stub(handlerHelpers, 'getAppPublicSignature')
      .resolves('publicSignature');
    sinon.stub(jwt, 'verify').returns({
      payload: {
        iss: 'testIssuer',
        accountId: '1',
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFunction', () => {
    it('Fails when missing required headers', () =>
      supertest(app)
        .post('/v1/create')
        .send({})
        .expect('content-type', /text\/plain/)
        .expect(403)
        .then((resp) => {
          chai
            .expect(resp.text)
            .to.eql('Please include authentication token in header "token"');
        }));

    it('Fails when missing name in body', () =>
      supertest(app)
        .post('/v1/create')
        .send({})
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(400)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql([
            {
              argument: 'name',
              instance: {},
              property: 'instance',
              message: 'requires property "name"',
              name: 'required',
              path: [],
              schema: '/CreateRequest',
              stack: 'instance requires property "name"',
            },
          ]);
        }));

    describe('when body and headers are proper', () => {
      it('succeeds when function does not already exist', () => {
        // Arrange
        const functionsCol = {
          findOne: sinon.stub().resolves(null),
          insertOne: sinon.stub().resolves(),
        };
        const database = {
          getCollection: sinon
            .stub()
            .withArgs('functions')
            .returns(functionsCol),
          close: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);

        // Act & Assert
        return supertest(app)
          .post('/v1/create')
          .send({ name: 'test' })
          .set('token', 'testToken')
          .expect('content-type', /application\/json/)
          .expect(201)
          .then((resp) => {
            const body = JSON.parse(resp.text);

            chai.expect(body.orid).to.exist;
            chai
              .expect(body.orid)
              .to.match(
                /^orid:1::::1:sf:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
              );

            chai.expect(functionsCol.insertOne.callCount).to.equal(1);
            chai.expect(database.close.callCount).to.equal(1);
          });
      });

      it('fails when function already exist', () => {
        // Arrange
        const functionsCol = {
          findOne: sinon.stub().resolves({ id: 'existing-id' }),
          insertOne: sinon.stub().resolves(),
        };
        const database = {
          getCollection: sinon
            .stub()
            .withArgs('functions')
            .returns(functionsCol),
          close: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);

        // Act & Assert
        return supertest(app)
          .post('/v1/create')
          .send({ name: 'test' })
          .set('token', 'testToken')
          .expect('content-type', /application\/json/)
          .expect(409)
          .then((resp) => {
            const body = JSON.parse(resp.text);

            chai.expect(body).to.deep.equal({ id: 'existing-id' });

            chai.expect(functionsCol.insertOne.callCount).to.equal(0);
            chai.expect(database.close.callCount).to.equal(1);
          });
      });
    });
  });

  describe('listFunctions', () => {
    it('returns list of items for the account', () => {
      // Arrange
      const functionsCol = {
        find: sinon.stub().returns({
          toArray: () =>
            Promise.resolve([
              {
                id: 'id1',
                name: 'test1',
                created: new Date().toISOString(),
              },
            ]),
        }),
        insertOne: sinon.stub().resolves(),
      };
      const database = {
        getCollection: sinon.stub().withArgs('functions').returns(functionsCol),
        close: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);

      // Act & Assert
      return supertest(app)
        .get('/v1/list')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql([
            {
              name: 'test1',
              orid: 'orid:1::::1:sf:id1',
            },
          ]);

          chai.expect(functionsCol.find.callCount).to.equal(1);
          chai.expect(database.close.callCount).to.equal(1);
        });
    });
  });

  describe('deleteFunction', () => {
    it('successfully removes function when it exists', () => {
      // Arrange
      const functionsCol = {
        deleteOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves({ providerFuncId: '12345678' }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().returns(functionsCol),
      };
      const fakeProvider = {
        deleteFunction: sinon.stub().resolves(true),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);

      // Act & Assert
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(204)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(functionsCol.deleteOne.callCount).to.equal(1);
          chai.expect(functionsCol.deleteOne.getCall(0).args).to.deep.equal([
            {
              accountId: '1',
              id: '12345678-1234-1234-1234-123456789ABC',
            },
          ]);
          chai.expect(fakeProvider.deleteFunction.callCount).to.equal(1);
          chai
            .expect(fakeProvider.deleteFunction.getCall(0).args)
            .to.deep.equal(['12345678']);
          chai.expect(database.close.callCount).to.equal(1);
        });
    });

    it('fails when provider delete function fails', () => {
      // Arrange
      const functionsCol = {
        deleteOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves({ providerFuncId: '12345678' }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().returns(functionsCol),
      };
      const fakeProvider = {
        deleteFunction: sinon.stub().resolves(false),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);

      // Act & Assert
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(500)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(functionsCol.deleteOne.callCount).to.equal(0);
          chai.expect(fakeProvider.deleteFunction.callCount).to.equal(1);
          chai
            .expect(fakeProvider.deleteFunction.getCall(0).args)
            .to.deep.equal(['12345678']);
          chai.expect(database.close.callCount).to.equal(1);
        });
    });

    it('successfully removes function when no provider exists', () => {
      // Arrange
      const functionsCol = {
        deleteOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves({ providerFuncId: '12345678' }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().returns(functionsCol),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').resolves(undefined);

      // Act & Assert
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(204)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(functionsCol.deleteOne.callCount).to.equal(1);
          chai.expect(functionsCol.deleteOne.getCall(0).args).to.deep.equal([
            {
              accountId: '1',
              id: '12345678-1234-1234-1234-123456789ABC',
            },
          ]);
          chai.expect(database.close.callCount).to.equal(1);
        });
    });

    it('returns not found when function does not exist in the database', () => {
      // Arrange
      const functionsCol = {
        deleteOne: sinon.stub(),
        findOne: sinon.stub().resolves(null),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().returns(functionsCol),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').resolves(undefined);

      // Act & Assert
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(404)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(functionsCol.deleteOne.callCount).to.equal(0);
          chai.expect(database.close.callCount).to.equal(1);
        });
    });
  });

  describe('uploadCodeToFunction', () => {
    describe('successfully builds code and updates user upon success', () => {
      it('when app exists in provider', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');
        const functionsCol = {
          findOne: sinon.stub().resolves({ providerFuncId: '12345678' }),
          updateOne: sinon.stub().resolves(),
        };
        const database = {
          close: sinon.stub(),
          getCollection: sinon.stub().returns(functionsCol),
        };
        const provider = {
          // createFunction: sinon.stub().resolves({ }),
          updateFunction: sinon.stub().resolves(true),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);
        sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);

        // Act & Assert
        return supertest(app)
          .post(
            '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('sourceArchive', fakeFile, 'testFile.zip')
          .expect(201)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
              status: 'buildComplete',
            });
          });
      });

      it('when app does not exists in provider', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');
        const functionsCol = {
          findOne: sinon.stub().resolves({}),
          updateOne: sinon.stub().resolves(),
        };
        const database = {
          close: sinon.stub(),
          getCollection: sinon.stub().returns(functionsCol),
        };
        const provider = {
          createFunction: sinon.stub().resolves('12345678'),
          updateFunction: sinon.stub().resolves(true),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);
        sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);
        const now = new Date();
        sinon.useFakeTimers(now);

        // Act & Assert
        return supertest(app)
          .post(
            '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('sourceArchive', fakeFile, 'testFile.zip')
          .expect(201)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
              status: 'buildComplete',
            });

            chai.expect(functionsCol.updateOne.callCount).to.equal(1);
            chai.expect(functionsCol.updateOne.getCall(0).args).to.deep.equal([
              { id: '12345678-1234-1234-1234-123456789ABC' },
              {
                $set: {
                  entryPoint: 'src/main:main',
                  lastUpdate: now.toISOString(),
                  providerFuncId: '12345678',
                  runtime: 'node',
                },
              },
              {
                writeConcern: {
                  j: true,
                  w: 'majority',
                  wtimeout: 30000,
                },
              },
            ]);
          });
      });
    });

    describe('validators', () => {
      it('validates post fields', () =>
        supertest(app)
          .post(
            '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .expect(400)
          .then((resp) => {
            const errors = JSON.parse(resp.text);
            chai.expect(errors).to.deep.equal([
              {
                argument: 'entryPoint',
                instance: {},
                message: 'requires property "entryPoint"',
                name: 'required',
                path: [],
                property: 'instance',
                schema: '/UploadCodeRequest',
                stack: 'instance requires property "entryPoint"',
              },
              {
                argument: 'runtime',
                instance: {},
                message: 'requires property "runtime"',
                name: 'required',
                path: [],
                property: 'instance',
                schema: '/UploadCodeRequest',
                stack: 'instance requires property "runtime"',
              },
            ]);
          }));

      it('validates post file correct field', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');

        // Act
        return supertest(app)
          .post(
            '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('file', fakeFile, 'testFile.zip')
          .expect(400)
          .then((resp) => {
            const errors = JSON.parse(resp.text);
            chai.expect(errors).to.deep.equal([
              {
                message: 'sourceArchive missing from payload',
              },
            ]);
          });
      });

      it('validates post file exists', () =>
        supertest(app)
          .post(
            '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .expect(400)
          .then((resp) => {
            const errors = JSON.parse(resp.text);
            chai.expect(errors).to.deep.equal([
              {
                message: 'sourceArchive missing from payload',
              },
            ]);
          }));
    });

    it('fails when attempting to create application in provider fails', () => {
      // Arrange
      const fakeFile = Buffer.from('fake file data');
      const functionsCol = {
        findOne: sinon.stub().resolves({}),
        updateOne: sinon.stub().resolves(),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().returns(functionsCol),
      };
      const provider = {
        createFunction: sinon.stub().resolves(undefined),
        updateFunction: sinon.stub().resolves(true),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);
      const now = new Date();
      sinon.useFakeTimers(now);

      // Act & Assert
      return supertest(app)
        .post(
          '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
        )
        .set('token', 'testToken')
        .field('entryPoint', 'src/main:main')
        .field('runtime', 'node')
        .attach('sourceArchive', fakeFile, 'testFile.zip')
        .expect(500)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
        });
    });

    it('Fails when function not found', () => {
      // Arrange
      const fakeFile = Buffer.from('fake file data');
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        updateOne: sinon.stub(),
        findOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);

      // Act
      return supertest(app)
        .post(
          '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
        )
        .set('token', 'testToken')
        .field('entryPoint', 'src/main:main')
        .field('runtime', 'node')
        .attach('sourceArchive', fakeFile, 'testFile.zip')
        .expect(404)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data.message).to.equal('Function not found.');
        });
    });

    it('Fails when unknown error occurs', () => {
      // Arrange
      const fakeFile = Buffer.from('fake file data');
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        updateOne: sinon.stub(),
        findOne: sinon.stub().throws(new Error('test error')),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);

      // Act
      return supertest(app)
        .post(
          '/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
        )
        .set('token', 'testToken')
        .field('entryPoint', 'src/main:main')
        .field('runtime', 'node')
        .attach('sourceArchive', fakeFile, 'testFile.zip')
        .expect(500)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
        });
    });
  });

  describe('invokeFunction', () => {
    it('Successfully invokes function in provider and returns function result w/o async', () => {
      // Arrange
      const functionsCol = {
        updateOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves({
          providerFuncId: '12345678',
        }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().withArgs('functions').returns(functionsCol),
      };
      const provider = {
        invokeFunction: sinon.stub().resolves({
          data: { result: true },
        }),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);

      // Act
      return supertest(app)
        .post('/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ test: 'input' })
        .expect(200)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data).to.deep.equal({
            result: true,
          });
          chai.expect(provider.invokeFunction.callCount).to.equal(1);
          chai
            .expect(provider.invokeFunction.getCall(0).args)
            .to.deep.equal(['12345678', { test: 'input' }]);
        });
    });

    it('Successfully invokes function in provider and returns function result w/ async', () => {
      // Arrange
      const functionsCol = {
        updateOne: sinon.stub().resolves(),
        findOne: sinon.stub().resolves({
          providerFuncId: '12345678',
        }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().withArgs('functions').returns(functionsCol),
      };
      const provider = {
        invokeFunction: sinon.stub().resolves({
          data: { result: true },
        }),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);
      sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);

      // Act
      return supertest(app)
        .post(
          '/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC?async=true',
        )
        .set('token', 'testToken')
        .send({ test: 'input' })
        .expect(202)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data).to.deep.equal({
            message: 'Request accepted. Function should begin soon.',
          });
          chai.expect(provider.invokeFunction.callCount).to.equal(1);
          chai
            .expect(provider.invokeFunction.getCall(0).args)
            .to.deep.equal(['12345678', { test: 'input' }]);
        });
    });

    describe('Returns error when', () => {
      it('function does not exist', () => {
        // Arrange
        const functionsCol = {
          updateOne: sinon.stub().resolves(),
          findOne: sinon.stub().resolves(),
        };
        const database = {
          close: sinon.stub(),
          getCollection: sinon
            .stub()
            .withArgs('functions')
            .returns(functionsCol),
        };
        const provider = {
          invokeFunction: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);
        sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);

        // Act
        return supertest(app)
          .post(
            '/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(404)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              message: 'Function not found.',
            });
            chai.expect(provider.invokeFunction.callCount).to.equal(0);
          });
      });

      it('function does not have providerFuncId', () => {
        // Arrange
        const functionsCol = {
          updateOne: sinon.stub().resolves(),
          findOne: sinon.stub().resolves({}),
        };
        const database = {
          close: sinon.stub(),
          getCollection: sinon
            .stub()
            .withArgs('functions')
            .returns(functionsCol),
        };
        const provider = {
          invokeFunction: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(database);
        sinon.stub(fnProvider, 'getProviderForRuntime').resolves(provider);

        // Act
        return supertest(app)
          .post(
            '/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
          )
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(422)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              message:
                'Function does not appear to have code associated yet. Please upload code then try again.',
            });
            chai.expect(provider.invokeFunction.callCount).to.equal(0);
          });
      });
    });
  });

  describe('inspectFunction', () => {
    it('returns details about the function when found', () => {
      // Arrange
      const now = new Date().toISOString();
      const functionsCol = {
        findOne: sinon.stub().resolves({
          id: '12345678-1234-1234-1234-123456789ABC',
          name: 'test function',
          version: 3,
          runtime: 'node',
          entryPoint: 'src/one:main',
          created: now,
          lastUpdate: now,
          lastInvoke: now,
        }),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().withArgs('functions').returns(functionsCol),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);

      // Act
      return supertest(app)
        .get('/v1/inspect/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .expect(200)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data).to.deep.equal({
            id: '12345678-1234-1234-1234-123456789ABC',
            orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
            name: 'test function',
            runtime: 'node',
            entryPoint: 'src/one:main',
            created: now,
            lastUpdate: now,
            lastInvoke: now,
          });
        });
    });

    it('returns not found when function does not exist', () => {
      // Arrange
      const functionsCol = {
        findOne: sinon.stub().resolves(),
      };
      const database = {
        close: sinon.stub(),
        getCollection: sinon.stub().withArgs('functions').returns(functionsCol),
      };
      sinon.stub(repo, 'getDatabase').resolves(database);

      // Act
      return supertest(app)
        .get('/v1/inspect/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .expect(404)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data).to.deep.equal({
            id: '12345678-1234-1234-1234-123456789ABC',
            message: 'Function not found.',
          });
        });
    });
  });
});
