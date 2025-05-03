import config from 'config';
import { v4 } from 'uuid';
import { CommandOperationOptions, MongoClient } from 'mongodb';

import {
  FunctionData,
  FunctionsRepo,
} from '../../core/interfaces/functions-repo';
import { BaseLogger } from 'pino';

const mutateOptions: CommandOperationOptions = {
  writeConcern: {
    w: 'majority',
    journal: true,
    wtimeoutMS: 30000,
  },
};

export class FunctionsRepoMongo implements FunctionsRepo {
  #mongoClientInternal;
  #logger;

  constructor({
    mongoClient,
    logger,
  }: {
    mongoClient: MongoClient;
    logger: BaseLogger;
  }) {
    this.#mongoClientInternal = mongoClient;
    this.#logger = logger;
  }

  get #mongoClient() {
    try {
      return this.#mongoClientInternal
        .connect()
        .then(() => this.#mongoClientInternal);
    } catch (err) {
      this.#logger.warn(err, 'Error connecting to mongo');
      throw new Error('Error connecting to mongo');
    }
  }

  get #collection() {
    return (async () => {
      const conn = await this.#mongoClient;
      const db = conn.db(config.get<string>('mongo.db'));
      return db.collection<FunctionData>('functions');
    })();
  }

  async listFunctions(accountId?: string): Promise<FunctionData[]> {
    const col = await this.#collection;

    return await col
      .find({
        accountId,
      })
      .toArray();
  }

  async getFunctionByNameAndAccount({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<FunctionData | null> {
    const col = await this.#collection;
    return await col.findOne({
      name,
      accountId,
    });
  }

  async getFunctionByIdAndAccount({
    id,
    accountId,
  }: {
    id: string;
    accountId: string;
  }): Promise<FunctionData | null> {
    const col = await this.#collection;
    return col.findOne({
      id,
      accountId,
    });
  }

  async createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string;
  }): Promise<string> {
    const col = await this.#collection;

    const newId = v4();
    await col.insertOne(
      {
        id: newId,
        name,
        accountId,
        created: new Date().toISOString(),
      },
      mutateOptions,
    );

    return newId;
  }

  async deleteFunction({
    id,
    accountId,
  }: {
    id: string;
    accountId: string;
  }): Promise<void> {
    const col = await this.#collection;

    await col.deleteOne(
      {
        id,
        accountId,
      },
      mutateOptions,
    );
  }

  async updateFunctionInfo({
    id,
    payload,
  }: {
    id: string;
    payload: Partial<FunctionData>;
  }) {
    const col = await this.#collection;

    await col.updateOne(
      { id },
      {
        $set: {
          ...payload,
          lastUpdate: new Date().toISOString(),
        },
      },
      mutateOptions,
    );
  }
}
