import { FunctionsRepoMongo } from '../functions-repo-mongo';

describe('functions-repo-mongo', () => {
  const fakeLogger = {
    warn: jest.fn(),
  };
  const writeConcern = {
    w: 'majority',
    journal: true,
    wtimeoutMS: 30000,
  };

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  function mockMongoClient({
    findResult,
    findOneResult,
  }: {
    findResult?: any[];
    findOneResult?: any;
  }) {
    const col = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockReturnValue(findResult),
      }),
      findOne: jest.fn().mockReturnValue(findOneResult),
      insertOne: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const mongoClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue(col),
      }),
    };
    return { mongoClient, col };
  }

  it('when mongo connection fails, throws error', async () => {
    // Arrange
    const mongoClient = {
      connect: jest.fn().mockImplementation(() => {
        throw new Error('test');
      }),
    };
    const functionsRepoMongo = new FunctionsRepoMongo({
      mongoClient: mongoClient as any,
      logger: fakeLogger as any,
    });

    // Act
    const result = functionsRepoMongo.listFunctions();

    // Assert
    await expect(result).rejects.toThrow('Error connecting to mongo');
  });

  describe('listFunctions', () => {
    it('when called without the account parameter, returns functions', async () => {
      // Arrange
      const expectedFunctions = [
        {
          id: '1',
          name: 'test',
          accountId: '1',
        },
      ];
      const { mongoClient, col } = mockMongoClient({
        findResult: expectedFunctions,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.listFunctions();

      // Assert
      expect(result).toEqual(expectedFunctions);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.find).toHaveBeenCalledWith({});
    });

    it('when called with the account parameter, returns functions', async () => {
      // Arrange
      const expectedFunctions = [
        {
          id: '1',
          name: 'test',
          accountId: '1',
        },
      ];
      const { mongoClient, col } = mockMongoClient({
        findResult: expectedFunctions,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.listFunctions('1');

      // Assert
      expect(result).toEqual(expectedFunctions);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.find).toHaveBeenCalledWith({ accountId: '1' });
    });
  });

  describe('getFunctionByNameAndAccount', () => {
    it('when function exists, returns function data', async () => {
      // Arrange
      const expectedFunction = {
        id: '1',
        name: 'test',
        accountId: '1',
      };
      const { mongoClient, col } = mockMongoClient({
        findOneResult: expectedFunction,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.getFunctionByNameAndAccount({
        name: 'test',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(expectedFunction);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.findOne).toHaveBeenCalledWith({
        name: 'test',
        accountId: '1',
      });
    });

    it('when function does not exist, returns null', async () => {
      // Arrange
      const { mongoClient, col } = mockMongoClient({
        findOneResult: null,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.getFunctionByNameAndAccount({
        name: 'test',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(null);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.findOne).toHaveBeenCalledWith({
        name: 'test',
        accountId: '1',
      });
    });
  });

  describe('getFunctionByIdAndAccount', () => {
    it('when function exists, returns function data', async () => {
      // Arrange
      const expectedFunction = {
        id: '1',
        name: 'test',
        accountId: '1',
      };
      const { mongoClient, col } = mockMongoClient({
        findOneResult: expectedFunction,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.getFunctionByIdAndAccount({
        id: '1',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(expectedFunction);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.findOne).toHaveBeenCalledWith({
        id: '1',
        accountId: '1',
      });
    });

    it('when function does not exist, returns null', async () => {
      // Arrange
      const { mongoClient, col } = mockMongoClient({
        findOneResult: null,
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.getFunctionByIdAndAccount({
        id: '1',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(null);
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.findOne).toHaveBeenCalledWith({
        id: '1',
        accountId: '1',
      });
    });
  });

  describe('createFunction', () => {
    it('creates function and returns new id', async () => {
      // Arrange
      const { mongoClient, col } = mockMongoClient({});
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      const result = await functionsRepoMongo.createFunction({
        name: 'test',
        accountId: '1',
      });

      // Assert
      expect(result).toEqual(expect.any(String));
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.insertOne).toHaveBeenCalledWith(
        {
          name: 'test',
          accountId: '1',
          id: expect.any(String),
          created: expect.any(String),
        },
        {
          writeConcern,
        },
      );
    });
  });

  describe('deleteFunction', () => {
    it('when function exists, deletes function', async () => {
      // Arrange
      const { mongoClient, col } = mockMongoClient({
        findOneResult: {
          id: '1',
          name: 'test',
          accountId: '1',
        },
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      await functionsRepoMongo.deleteFunction({
        id: '1',
        accountId: '1',
      });

      // Assert
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.deleteOne).toHaveBeenCalledWith(
        {
          id: '1',
          accountId: '1',
        },
        {
          writeConcern,
        },
      );
    });
  });

  describe('updateFunctionInfo', () => {
    it('when function exists, updates function', async () => {
      // Arrange
      const { mongoClient, col } = mockMongoClient({
        findOneResult: {
          id: '1',
          name: 'test',
          accountId: '1',
        },
      });
      const functionsRepoMongo = new FunctionsRepoMongo({
        mongoClient: mongoClient as any,
        logger: fakeLogger as any,
      });

      // Act
      await functionsRepoMongo.updateFunctionInfo({
        id: '1',
        payload: {
          name: 'test2',
        },
      });

      // Assert
      expect(mongoClient.db).toHaveBeenCalledWith(
        'mdsCloudServerlessFunctions',
      );
      expect(mongoClient.db().collection).toHaveBeenCalledWith('functions');
      expect(col.updateOne).toHaveBeenCalledWith(
        {
          id: '1',
        },
        {
          $set: {
            name: 'test2',
            lastUpdate: expect.any(String),
          },
        },
        {
          writeConcern,
        },
      );
    });
  });
});
