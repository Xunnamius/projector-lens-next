import cloneDeep from 'clone-deep';
import { MongoClient } from 'mongodb';
import { NULL_KEY, DUMMY_KEY } from 'universe/backend';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getEnv } from 'universe/backend/env';

import {
  getDb,
  getSystemDb,
  overwriteMemory,
  destroySystemDb,
  initializeSystemDb,
  getDbClient
} from 'universe/backend/db';

import type { Db, WithId, OptionalId } from 'mongodb';
import type { ApiKey, RequestLogEntry, LimitedLogEntry } from 'types/global';

export type DummySystemData = {
  keys: ApiKey[];
};

export type HydratedDummySystemData = {
  [P in keyof DummySystemData]: DummySystemData[P] extends Array<infer T> | undefined
    ? WithId<T>[]
    : WithId<DummySystemData[P]>;
};

export const unhydratedDummySystemData: DummySystemData = {
  keys: [
    {
      owner: 'key1',
      key: DUMMY_KEY
    },
    {
      owner: 'key2',
      key: 'xyz4c4d3-294a-4086-9751-f3fce82da'
    }
  ]
};

export async function hydrateDb<T>(db: Db, collection: string, data: OptionalId<T>[]) {
  const newData = cloneDeep(data);

  await db.collection<T>(collection).insertMany(newData);
  return newData;
}

export async function hydrateSystemDb(systemDb: Db, data: DummySystemData) {
  const newData = cloneDeep(data);

  await Promise.all([
    ...[
      newData.keys.length ? systemDb.collection('keys').insertMany(newData.keys) : null
    ],

    systemDb.collection<WithId<RequestLogEntry>>('request-log').insertMany(
      [...Array(22)].map((_, ndx) => ({
        ip: '1.2.3.4',
        key: ndx % 2 ? null : NULL_KEY,
        method: ndx % 3 ? 'GET' : 'POST',
        route: 'fake/route',
        time: Date.now() + 10 ** 6,
        resStatusCode: 200
      }))
    ),

    systemDb
      .collection<WithId<LimitedLogEntry>>('limited-log-mview')
      .insertMany([
        { ip: '1.2.3.4', until: Date.now() + 1000 * 60 * 15 } as LimitedLogEntry,
        { ip: '5.6.7.8', until: Date.now() + 1000 * 60 * 15 } as LimitedLogEntry,
        { key: NULL_KEY, until: Date.now() + 1000 * 60 * 60 } as LimitedLogEntry
      ])
  ]);

  return newData as HydratedDummySystemData;
}

export function setupJestTestDb() {
  const port = getEnv().NODE_VSCODE_INSPECT ? getEnv().MONGODB_MS_PORT : undefined;

  const server = new MongoMemoryServer({
    instance: {
      port,
      // ? As of 4.2.9, Mongo errors without this line
      args: ['--enableMajorityReadConcern=0']
    }
  });

  let uri: string;
  let hydratedData: HydratedDummySystemData;
  let oldEnv: typeof process.env;

  /**
   * Similar to getSystemDb except it creates a brand new MongoClient
   * connection before selecting and returning the database.
   */
  const getNewClientAndSystemDb = async () => {
    // TODO: ensure connection procedure below actually connects to a database
    uri = uri ?? (await server.getUri('test')); // ? Ensure singleton
    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db('global-api--system');

    if (!db) throw new Error('unable to connect to system database');
    return { client, databases: { 'global-api--system': db } };
  };

  beforeAll(async () => {
    overwriteMemory(await getNewClientAndSystemDb());
  });

  beforeEach(async () => {
    oldEnv = process.env;
    const db = await getSystemDb();
    await initializeSystemDb(db);
    hydratedData = await hydrateSystemDb(db, unhydratedDummySystemData);
  });

  afterEach(async () => {
    process.env = oldEnv;
    const db = await getSystemDb();
    await destroySystemDb(db);
  });

  afterAll(async () => {
    const client = await getDbClient();
    client.isConnected() && (await client.close());
    await server.stop();
  });

  return {
    getDb,
    getSystemDb,
    getDbClient,
    getNewClientAndSystemDb,
    getHydratedData: () => hydratedData
  };
}
