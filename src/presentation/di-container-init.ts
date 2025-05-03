import { Cradle } from '@fastify/awilix';
import { asClass, asFunction, AwilixContainer, Lifetime } from 'awilix';
import config from 'config';
import { MongoClient } from 'mongodb';
import { Logic } from '../core/classes/logic';
import { FastifyInstance } from 'fastify';
import { AuthManager as MdsSdkAuthManager } from '@maddonkeysoftware/mds-cloud-sdk-node/lib/auth-manager';
import { FunctionsRepoMongo } from '../infrastructure/repos/functions-repo-mongo';
import { FunctionsProviderFactory } from '../core/classes/functions-provider-factory';
import { InMemoryCache } from '@maddonkeysoftware/mds-cloud-sdk-node/lib';
import { ProviderConfiguration } from '../core/types/provider-configuration';

/**
 * Documentation available at https://github.com/jeffijoe/awilix
 * @param args the argument object
 * @param args.diContainer The DI container to configure
 * @param args.server The fastify server instance
 */
export function diContainerInit({
  diContainer,
  server,
}: {
  diContainer: AwilixContainer<Cradle>;
  server: FastifyInstance;
}) {
  // NOTE: Keep the keys in alphabetical order to make it easier to find
  diContainer.register({
    functionsProviderFactory: asClass(FunctionsProviderFactory, {
      lifetime: Lifetime.SCOPED,
      injector: () => {
        return {
          configuration: config.get<ProviderConfiguration>('providerConfig'),
        };
      },
    }),

    functionsRepo: asClass(FunctionsRepoMongo, {
      lifetime: Lifetime.SCOPED,
    }),

    logger: asFunction(
      () => {
        return server.log;
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    logic: asClass(Logic, {
      lifetime: Lifetime.SCOPED,
    }),

    mdsAuthManager: asFunction(
      () => {
        const mdsSdkConfig = config.get<Record<string, string>>('mdsSdk');
        return new MdsSdkAuthManager({
          cache: new InMemoryCache(),
          ...mdsSdkConfig,
        });
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    mongoClient: asFunction(
      () => {
        return new MongoClient(config.get<string>('mongo.url'), {
          // TODO: Do we need any options here?
          // useNewUrlParser: true,
          // useUnifiedTopology: true,
        });
      },
      {
        lifetime: Lifetime.SCOPED,
        dispose: async (mongoClient) => {
          try {
            await mongoClient.close();
          } catch (err) {
            /* ignore */
          }
        },
      },
    ),

    // queueRepo: asClass(QueueRepoRedis, {
    //   lifetime: Lifetime.SCOPED,
    // }),
    //
    // redisClient: asFunction(
    //   () => {
    //     const client = createClient({
    //       url: config.get<string>('redisUrl'),
    //     });
    //     return client;
    //   },
    //   {
    //     // NOTE: if we use non-transient here the queue will close the connection on us when pending operations are still running
    //     lifetime: Lifetime.SCOPED,
    //     dispose: async (redisClient) => {
    //       try {
    //         await redisClient.quit();
    //       } catch (err) {
    //         /* ignore */
    //       }
    //     },
    //   },
    // ),
    //
    // redisSmq: asFunction(
    //   () => {
    //     // TODO: Find a better library or get off redis for queues all-together.
    //     // HACK: This library does not like the client supplied and is fairly out of date.
    //     // When supplying a client that doesn't have a constructor named "RedisClient" it
    //     // will use an internal localhost connection. Since we don't want that we must
    //     // provide the host and port directly.
    //     const [host, port] = /redis:\/\/([^:]+):(\d+)/
    //       .exec(config.get<string>('redisUrl'))
    //       ?.slice(1) as [string, string];
    //     return new RedisSMQ({
    //       host,
    //       port: Number(port),
    //     });
    //   },
    //   {
    //     lifetime: Lifetime.SCOPED,
    //     dispose: async (redisSmq) => {
    //       // await new Promise((res, rej) => {
    //       await new Promise((res, rej) => {
    //         // Delay the quit to give the queue time to finish processing
    //         setTimeout(() => {
    //           redisSmq.quit((err) => {
    //             /* istanbul ignore next */
    //             if (err) {
    //               rej(err);
    //             }
    //             res(null);
    //           });
    //         }, 200);
    //       });
    //     },
    //   },
    // ),
    //
    // resourceInvoker: asClass(IntervalInvoker, {
    //   lifetime: Lifetime.SINGLETON,
    //   injector: (container) => {
    //     return {
    //       pollInterval: 1000,
    //       callback: resourceInvokerCallback({ container }),
    //     };
    //   },
    //   dispose: (instance) => {
    //     instance.stopMonitor();
    //   },
    // }),
  });

  return Promise.resolve();
}
