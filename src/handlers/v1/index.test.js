/* eslint-disable no-unused-expressions */
const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');
const jwt = require('jsonwebtoken');
const mds = require('@maddonkeysoftware/mds-cloud-sdk-node');
const axios = require('axios');

const src = require('../..');
const repo = require('../../repo');
const fnProvider = require('../../fnProviders');
const fnProjectProvider = require('../../fnProviders/fnProject');
const handlerHelpers = require('../handler-helpers');
const helpers = require('../../helpers');
const globals = require('../../globals');
const simpleThrottle = require('../../simpleThrottle');

describe('src/handlers/v1/index', () => {
  const app = src.buildApp();

  beforeEach(() => {
    sinon.stub(handlerHelpers, 'getIssuer').returns('testIssuer');
    sinon.stub(handlerHelpers, 'getAppPublicSignature').resolves('publicSignature');
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

  describe('create', () => {
    it('Fails when missing required headers', () => supertest(app)
      .post('/v1/create')
      .send({})
      .expect('content-type', /text\/plain/)
      .expect(403)
      .then((resp) => {
        chai.expect(resp.text).to.eql('Please include authentication token in header "token"');
      }));

    it('Fails when missing name in body', () => supertest(app)
      .post('/v1/create')
      .send({ })
      .set('token', 'testToken')
      .expect('content-type', /application\/json/)
      .expect(400)
      .then((resp) => {
        const body = JSON.parse(resp.text);

        chai.expect(body).to.eql([{
          argument: 'name',
          instance: { },
          property: 'instance',
          message: 'requires property "name"',
          name: 'required',
          path: [],
          schema: '/CreateRequest',
          stack: 'instance requires property "name"',
        }]);
      }));

    describe('headers and body are proper', () => {
      it('Succeeds when no existing record', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeCollection = {
          insertOne: sinon.stub(),
          findOne: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection.returns(fakeCollection);
        fakeCollection.insertOne.resolves();
        fakeCollection.findOne.resolves(null);
        sinon.stub(fnProjectProvider, 'createApp').resolves({ id: 'appId' });
        sinon.stub(fnProjectProvider, 'findAppIdByName').resolves('some-app-id');

        // Act / Assert
        return supertest(app)
          .post('/v1/create')
          .send({ name: 'test' })
          .set('token', 'testToken')
          .expect('content-type', /application\/json/)
          .expect(201)
          .then((resp) => {
            const body = JSON.parse(resp.text);

            chai.expect(body.orid).to.exist;
            chai.expect(body.orid).to.match(/^orid:1::::1:sf:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g);

            chai.expect(fakeCollection.insertOne.callCount).to.equal(1);
            chai.expect(fakeDatabase.close.callCount).to.equal(1);
          });
      });

      it('Fails when existing record', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeCollection = {
          insertOne: sinon.stub(),
          findOne: sinon.stub(),
        };
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection.returns(fakeCollection);
        fakeCollection.insertOne.resolves();
        fakeCollection.findOne.resolves({});

        // Act / Assert
        return supertest(app)
          .post('/v1/create')
          .send({ name: 'test' })
          .set('token', 'testToken')
          .expect('content-type', /application\/json/)
          .expect(409)
          .then((resp) => {
            const body = JSON.parse(resp.text);

            chai.expect(body).to.eql({});

            chai.expect(fakeCollection.insertOne.callCount).to.equal(0);
            chai.expect(fakeDatabase.close.callCount).to.equal(1);
          });
      });
    });
  });

  describe('list', () => {
    it('Returns list of items for account when exists', () => {
      // Arrange
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeCollection = {
        find: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection.returns(fakeCollection);
      fakeCollection.find.returns({
        toArray: () => Promise.resolve([{
          id: 'id1',
          name: 'test1',
          created: 'abcde',
        }]),
      });

      // Act / Assert
      return supertest(app)
        .get('/v1/list')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql([{
            name: 'test1',
            orid: 'orid:1::::1:sf:id1',
          }]);

          chai.expect(fakeCollection.find.callCount).to.equal(1);
          chai.expect(fakeDatabase.close.callCount).to.equal(1);
        });
    });
  });

  describe('delete', () => {
    it('successfully removes function when exists', () => {
      // Arrange
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeCollection = {
        deleteOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      const fakeProvider = {
        deleteFunction: sinon.stub().resolves(true),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection.returns(fakeCollection);
      fakeCollection.findOne.resolves({ funcId: '12345678' });
      fakeCollection.deleteOne.resolves();
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);

      // Act
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(204)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(fakeCollection.deleteOne.callCount).to.equal(1);
          chai.expect(fakeCollection.deleteOne.getCall(0).args).to.deep.equal([{
            accountId: '1',
            id: '12345678-1234-1234-1234-123456789ABC',
          }]);
          chai.expect(fakeProvider.deleteFunction.callCount).to.equal(1);
          chai.expect(fakeProvider.deleteFunction.getCall(0).args).to.deep.equal([
            '12345678',
          ]);
          chai.expect(fakeDatabase.close.callCount).to.equal(1);
        });
    });

    it('fails when remove from function provider fails', () => {
      // Arrange
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeCollection = {
        deleteOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      const fakeProvider = {
        deleteFunction: sinon.stub().resolves(false),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection.returns(fakeCollection);
      fakeCollection.findOne.resolves({ funcId: '12345678' });
      fakeCollection.deleteOne.resolves();
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);

      // Act
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(500)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(fakeCollection.deleteOne.callCount).to.equal(0);
          chai.expect(fakeProvider.deleteFunction.callCount).to.equal(1);
          chai.expect(fakeProvider.deleteFunction.getCall(0).args).to.deep.equal([
            '12345678',
          ]);
          chai.expect(fakeDatabase.close.callCount).to.equal(1);
        });
    });

    it('successfully removes function when no provider exists', () => {
      // Arrange
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeCollection = {
        deleteOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection.returns(fakeCollection);
      fakeCollection.findOne.resolves({ funcId: '12345678' });
      fakeCollection.deleteOne.resolves();
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(undefined);

      // Act
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(204)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(fakeCollection.deleteOne.callCount).to.equal(1);
          chai.expect(fakeCollection.deleteOne.getCall(0).args).to.deep.equal([{
            accountId: '1',
            id: '12345678-1234-1234-1234-123456789ABC',
          }]);
          chai.expect(fakeDatabase.close.callCount).to.equal(1);
        });
    });

    it('returns not found when function does not exist in database', () => {
      // Arrange
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeCollection = {
        deleteOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection.returns(fakeCollection);
      fakeCollection.findOne.resolves();
      sinon.stub(fnProvider, 'getProviderForRuntime');

      // Act
      return supertest(app)
        .delete('/v1/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .send({ name: 'test' })
        .expect(404)
        .then((resp) => {
          chai.expect(resp.text).to.equal('');
          chai.expect(fakeCollection.deleteOne.callCount).to.equal(0);
          chai.expect(fnProvider.getProviderForRuntime.callCount).to.equal(0);
          chai.expect(fakeDatabase.close.callCount).to.equal(1);
        });
    });
  });

  describe('upload code to function', () => {
    describe('Successfully dispatches build and updates user upon success', () => {
      it('App already exists in provider', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };
        const fakeProviderMetadataCollection = {
          findOne: sinon.stub(),
        };
        const fakeProvider = {
          NAME: 'fnProject',
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_WORK_CONTAINER')
          .returns('/tmp/workContainer')
          .withArgs('MDS_FN_WORK_QUEUE')
          .returns('orid:1::::1:qs:workQueue')
          .withArgs('MDS_FN_NOTIFICATION_TOPIC')
          .returns('orid:1::::1:ns:workTopic')
          .withArgs('MDS_FN_INVOKE_URL_TEMPLATE')
          .returns('http://testUrl:1234/invoke/{funcId}');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection)
          .withArgs('providerMetadata')
          .returns(fakeProviderMetadataCollection);
        fakeFunctionsCollection.findOne.resolves({ funcId: '12345678' });
        fakeFunctionsCollection.updateOne.resolves();
        fakeProviderMetadataCollection.findOne.resolves({ accountId: '1', fnProject: 'fnProjectId' });
        sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);
        sinon.stub(mds, 'getFileServiceClient').returns({
          uploadFile: sinon.stub().resolves(),
        });
        sinon.stub(mds, 'getQueueServiceClient').returns({
          enqueueMessage: sinon.stub().resolves(),
        });

        let eventId;
        sinon.stub(mds, 'getNotificationServiceClient').returns({
          emit: sinon.stub().callsFake((topic, data) => {
            eventId = data.eventId;
            return Promise.resolve();
          }),
          on: (topic, cb) => globals.delay(1).then(() => cb({
            message: { eventId, status: 'buildComplete' },
          })),
          close: sinon.stub(),
        });

        // Act
        return supertest(app)
          .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('sourceArchive', fakeFile, 'testFile.zip')
          .expect(201)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              invokeUrl: 'http://testUrl:1234/invoke/12345678-1234-1234-1234-123456789ABC',
              orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
              status: 'buildComplete',
            });
          });
      });

      it('App does not exist in provider', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };
        const fakeProviderMetadataCollection = {
          findOne: sinon.stub(),
          updateOne: sinon.stub(),
        };
        const fakeProvider = {
          NAME: 'fnProject',
          buildAppName: () => 'testAppName',
          findAppIdByName: sinon.stub().resolves(),
          createApp: sinon.stub().withArgs('testAppName').resolves('testAppId'),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_WORK_CONTAINER')
          .returns('/tmp/workContainer')
          .withArgs('MDS_FN_WORK_QUEUE')
          .returns('orid:1::::1:qs:workQueue')
          .withArgs('MDS_FN_NOTIFICATION_TOPIC')
          .returns('orid:1::::1:ns:workTopic')
          .withArgs('MDS_FN_INVOKE_URL_TEMPLATE')
          .returns('http://testUrl:1234/invoke/{funcId}');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection)
          .withArgs('providerMetadata')
          .returns(fakeProviderMetadataCollection);
        fakeFunctionsCollection.findOne.resolves({ funcId: '12345678' });
        fakeFunctionsCollection.updateOne.resolves();
        fakeProviderMetadataCollection.findOne.resolves();
        sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);
        sinon.stub(mds, 'getFileServiceClient').returns({
          uploadFile: sinon.stub().resolves(),
        });
        sinon.stub(mds, 'getQueueServiceClient').returns({
          enqueueMessage: sinon.stub().resolves(),
        });

        let eventId;
        sinon.stub(mds, 'getNotificationServiceClient').returns({
          emit: sinon.stub().callsFake((topic, data) => {
            eventId = data.eventId;
            return Promise.resolve();
          }),
          on: (topic, cb) => globals.delay(1).then(() => cb({
            message: { eventId, status: 'buildComplete' },
          })),
          close: sinon.stub(),
        });

        // Act
        return supertest(app)
          .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('sourceArchive', fakeFile, 'testFile.zip')
          .expect(201)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              invokeUrl: 'http://testUrl:1234/invoke/12345678-1234-1234-1234-123456789ABC',
              orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
              status: 'buildComplete',
            });

            chai.expect(fakeProviderMetadataCollection.updateOne.callCount).to.equal(1);
            chai.expect(fakeProviderMetadataCollection.updateOne.getCall(0).args).to.deep.equal([
              { accountId: '1' },
              { $set: { fnProject: 'testAppId' } },
              { upsert: true },
            ]);
          });
      });

      it('App does exist in provider but not DB', () => {
        // Arrange
        const fakeFile = Buffer.from('fake file data');
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };
        const fakeProviderMetadataCollection = {
          findOne: sinon.stub(),
          updateOne: sinon.stub(),
        };
        const fakeProvider = {
          NAME: 'fnProject',
          buildAppName: () => 'testAppName',
          findAppIdByName: sinon.stub().resolves('testAppId'),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_WORK_CONTAINER')
          .returns('/tmp/workContainer')
          .withArgs('MDS_FN_WORK_QUEUE')
          .returns('orid:1::::1:qs:workQueue')
          .withArgs('MDS_FN_NOTIFICATION_TOPIC')
          .returns('orid:1::::1:ns:workTopic')
          .withArgs('MDS_FN_INVOKE_URL_TEMPLATE')
          .returns('http://testUrl:1234/invoke/{funcId}');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection)
          .withArgs('providerMetadata')
          .returns(fakeProviderMetadataCollection);
        fakeFunctionsCollection.findOne.resolves({ funcId: '12345678' });
        fakeFunctionsCollection.updateOne.resolves();
        fakeProviderMetadataCollection.findOne.resolves();
        sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);
        sinon.stub(mds, 'getFileServiceClient').returns({
          uploadFile: sinon.stub().resolves(),
        });
        sinon.stub(mds, 'getQueueServiceClient').returns({
          enqueueMessage: sinon.stub().resolves(),
        });

        let eventId;
        sinon.stub(mds, 'getNotificationServiceClient').returns({
          emit: sinon.stub().callsFake((topic, data) => {
            eventId = data.eventId;
            return Promise.resolve();
          }),
          on: (topic, cb) => globals.delay(1).then(() => cb({
            message: { eventId, status: 'buildComplete' },
          })),
          close: sinon.stub(),
        });

        // Act
        return supertest(app)
          .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .field('entryPoint', 'src/main:main')
          .field('runtime', 'node')
          .attach('sourceArchive', fakeFile, 'testFile.zip')
          .expect(201)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              invokeUrl: 'http://testUrl:1234/invoke/12345678-1234-1234-1234-123456789ABC',
              orid: 'orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC',
              status: 'buildComplete',
            });

            chai.expect(fakeProviderMetadataCollection.updateOne.callCount).to.equal(1);
            chai.expect(fakeProviderMetadataCollection.updateOne.getCall(0).args).to.deep.equal([
              { accountId: '1' },
              { $set: { fnProject: 'testAppId' } },
              { upsert: true },
            ]);
          });
      });
    });

    it('Fails when attempting to create application in provider', () => {
      // Arrange
      const fakeFile = Buffer.from('fake file data');
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        updateOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      const fakeProviderMetadataCollection = {
        findOne: sinon.stub(),
        updateOne: sinon.stub(),
      };
      const fakeProvider = {
        NAME: 'fnProject',
        buildAppName: () => 'testAppName',
        findAppIdByName: sinon.stub().resolves(),
        createApp: sinon.stub().withArgs('testAppName').resolves(),
      };

      sinon.stub(helpers, 'getEnvVar')
        .withArgs('MDS_FN_WORK_CONTAINER')
        .returns('/tmp/workContainer')
        .withArgs('MDS_FN_WORK_QUEUE')
        .returns('orid:1::::1:qs:workQueue')
        .withArgs('MDS_FN_NOTIFICATION_TOPIC')
        .returns('orid:1::::1:ns:workTopic');
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection)
        .withArgs('providerMetadata')
        .returns(fakeProviderMetadataCollection);
      fakeFunctionsCollection.findOne.resolves({ funcId: '12345678' });
      fakeFunctionsCollection.updateOne.resolves();
      fakeProviderMetadataCollection.findOne.resolves();
      sinon.stub(fnProvider, 'getProviderForRuntime').returns(fakeProvider);
      sinon.stub(mds, 'getFileServiceClient').returns({
        uploadFile: sinon.stub().resolves(),
      });
      sinon.stub(mds, 'getQueueServiceClient').returns({
        enqueueMessage: sinon.stub().resolves(),
      });

      let eventId;
      sinon.stub(mds, 'getNotificationServiceClient').returns({
        emit: sinon.stub().callsFake((topic, data) => {
          eventId = data.eventId;
          return Promise.resolve();
        }),
        on: (topic, cb) => globals.delay(1).then(() => cb({
          message: { eventId, status: 'buildComplete' },
        })),
        close: sinon.stub(),
      });

      // Act
      return supertest(app)
        .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
        .set('token', 'testToken')
        .field('entryPoint', 'src/main:main')
        .field('runtime', 'node')
        .attach('sourceArchive', fakeFile, 'testFile.zip')
        .expect(500)
        .then((resp) => {
          const data = JSON.parse(resp.text);
          chai.expect(data.message).to.equal('An internal error has occurred');
          chai.expect(data.referenceNumber).to.exist;

          chai.expect(fakeProviderMetadataCollection.updateOne.callCount).to.equal(0);
        });
    });

    describe('validators', () => {
      it('validates post fields', () => supertest(app)
        .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
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
          .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
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

      it('validates post file exists', () => supertest(app)
        .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
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

    it('Fails when function not found', () => {
      // Arrange
      const fakeFile = Buffer.from('fake file data');
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        updateOne: sinon.stub(),
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);
      fakeFunctionsCollection.findOne.resolves();

      // Act
      return supertest(app)
        .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
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
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);
      fakeFunctionsCollection.findOne.throws(new Error('test error'));

      // Act
      return supertest(app)
        .post('/v1/uploadCode/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
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

  describe('invoke function', () => {
    describe('Successfully invokes function in provider and returns function result', () => {
      it('using the invoke throttle', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

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
            chai.expect(axios.post.callCount).to.equal(1);
            chai.expect(axios.post.getCall(0).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(0).args[1]).to.deep.equal({
              test: 'input',
            });
          });
      });

      it('not using the invoke throttle', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

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
            chai.expect(axios.post.callCount).to.equal(1);
            chai.expect(axios.post.getCall(0).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(0).args[1]).to.deep.equal({
              test: 'input',
            });
          });
      });

      it('using async query parameter', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

        // Act
        return supertest(app)
          .post('/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC?async=true')
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(202)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              message: 'Request accepted. Function should begin soon.',
            });
            chai.expect(axios.post.callCount).to.equal(1);
            chai.expect(axios.post.getCall(0).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(0).args[1]).to.deep.equal({
              test: 'input',
            });
          });
      });
    });

    describe('Retries function invoke', () => {
      beforeEach(() => {
        sinon.stub(globals, 'delay').resolves();
      });

      it('if first call returns 5XX', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post')
          .onCall(0)
          .resolves({ status: 500, data: { result: true } })
          .onCall(1)
          .resolves({ status: 200, data: { result: true } });

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
            chai.expect(axios.post.callCount).to.equal(2);
            chai.expect(axios.post.getCall(0).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(0).args[1]).to.deep.equal({
              test: 'input',
            });
            chai.expect(axios.post.getCall(1).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(1).args[1]).to.deep.equal({
              test: 'input',
            });
          });
      });

      it('if first call throws exception', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post')
          .onCall(0)
          .throws(new Error('test error'))
          .onCall(1)
          .resolves({ status: 200, data: { result: true } });

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
            chai.expect(axios.post.callCount).to.equal(2);
            chai.expect(axios.post.getCall(0).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(0).args[1]).to.deep.equal({
              test: 'input',
            });
            chai.expect(axios.post.getCall(1).args[0]).to.equal('http://localhost:1234/12345678');
            chai.expect(axios.post.getCall(1).args[1]).to.deep.equal({
              test: 'input',
            });
          });
      });
    });

    describe('Returns error when', () => {
      it('Function does not exist', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves();
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

        // Act
        return supertest(app)
          .post('/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(404)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              message: 'Function not found.',
            });
            chai.expect(axios.post.callCount).to.equal(0);
          });
      });

      it('Too many function instances running', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
          invokeUrl: 'http://localhost:1234/12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').rejects();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

        // Act
        return supertest(app)
          .post('/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(429)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              message: 'Too many requests',
            });
            chai.expect(axios.post.callCount).to.equal(0);
          });
      });

      it('Function does not have code associated yet', () => {
        // Arrange
        const fakeDatabase = {
          close: sinon.stub(),
          getCollection: sinon.stub(),
        };
        const fakeFunctionsCollection = {
          updateOne: sinon.stub(),
          findOne: sinon.stub(),
        };

        sinon.stub(helpers, 'getEnvVar')
          .withArgs('MDS_FN_USE_INVOKE_THROTTLE')
          .returns('true');
        sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
        fakeDatabase.getCollection
          .withArgs('functions')
          .returns(fakeFunctionsCollection);
        fakeFunctionsCollection.findOne.resolves({
          funcId: '12345678',
        });
        fakeFunctionsCollection.updateOne.resolves();
        sinon.stub(simpleThrottle, 'acquire').resolves();
        sinon.stub(simpleThrottle, 'release').resolves();
        sinon.stub(axios, 'post').resolves({ status: 200, data: { result: true } });

        // Act
        return supertest(app)
          .post('/v1/invoke/orid:1::::1:sf:12345678-1234-1234-1234-123456789ABC')
          .set('token', 'testToken')
          .send({ test: 'input' })
          .expect(422)
          .then((resp) => {
            const data = JSON.parse(resp.text);
            chai.expect(data).to.deep.equal({
              id: '12345678-1234-1234-1234-123456789ABC',
              message: 'Function does not appear to have code associated yet. Please upload code then try again.',
            });
            chai.expect(axios.post.callCount).to.equal(0);
          });
      });
    });
  });

  describe('inspect function', () => {
    it('returns details about the function when found', () => {
      // Arrange
      const now = new Date().toISOString();
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);
      fakeFunctionsCollection.findOne.resolves({
        id: '12345678-1234-1234-1234-123456789ABC',
        name: 'test function',
        version: 3,
        runtime: 'node',
        entryPoint: 'src/one:main',
        created: now,
        lastUpdate: now,
        lastInvoke: now,
      });

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
            version: '3',
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
      const fakeDatabase = {
        close: sinon.stub(),
        getCollection: sinon.stub(),
      };
      const fakeFunctionsCollection = {
        findOne: sinon.stub(),
      };
      sinon.stub(repo, 'getDatabase').resolves(fakeDatabase);
      fakeDatabase.getCollection
        .withArgs('functions')
        .returns(fakeFunctionsCollection);
      fakeFunctionsCollection.findOne.resolves();

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
