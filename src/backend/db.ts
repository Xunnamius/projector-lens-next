import { MongoClient, Db } from 'mongodb';
import { getEnv } from 'universe/backend/env';

export type InternalMemory = {
  client: MongoClient;
  databases: Record<string, Db>;
};

let memory: InternalMemory | null = null;

/**
 * Used to lazily create the MongoClient singleton once on-demand instead of
 * immediately when the app runs. If `external = true`, then env variable
 * `EXTERNAL_SCRIPTS_MONGODB_URI` will be used instead of `MONGODB_URI`.
 */
export async function getDbClient({ external }: { external?: boolean } = {}) {
  !memory && (memory = {} as InternalMemory);

  if (!memory.client) {
    let uri = getEnv().MONGODB_URI;

    if (external) {
      uri = getEnv().EXTERNAL_SCRIPTS_MONGODB_URI;
      getEnv().EXTERNAL_SCRIPTS_BE_VERBOSE &&
        // eslint-disable-next-line no-console
        console.log(`[ connecting to mongo database at ${uri} ]`);
    }

    memory.client = await MongoClient.connect(uri, { useUnifiedTopology: true });
  }

  return memory.client;
}

/**
 * Used to lazily create a database singleton on-demand instead of immediately
 * when the app runs.
 */
export async function getDb({ name, external }: { name: string; external?: boolean }) {
  !memory && (memory = {} as InternalMemory);

  await getDbClient({ external });

  !memory.databases && (memory.databases = {});
  !memory.databases[name] && (memory.databases[name] = memory.client.db(name));

  return memory.databases[name];
}

/**
 * Used to lazily create the system database singleton on-demand instead of
 * immediately when the app runs.
 */
export async function getSystemDb({ external }: { external?: boolean } = {}) {
  return getDb({ name: getEnv().MONGODB_SYSTEM_DB, external });
}

/**
 * Used to kill the MongoClient and close any lingering database connections.
 */
export async function closeDbClient() {
  memory?.client.isConnected() && (await memory?.client.close());
  memory = null;
}

/**
 * Mutates internal memory. Used for testing purposes.
 */
export function overwriteMemory(newMemory: InternalMemory) {
  memory = newMemory;
}

/**
 * Destroys all collections in the system database. This function is idempotent
 * and can be called multiple times without worry.
 */
export async function destroySystemDb(db: Db) {
  await Promise.allSettled([
    db.dropCollection('keys'),
    db.dropCollection('request-log'),
    db.dropCollection('limited-log-mview')
  ]);
}

/**
 * Initialize the system database and collections. This function is idempotent
 * and can be called multiple times without worry.
 */
export async function initializeSystemDb(db: Db) {
  await Promise.all([
    db.createCollection('keys'),
    db.createCollection('request-log'),
    db.createCollection('limited-log-mview')
  ]);
}
