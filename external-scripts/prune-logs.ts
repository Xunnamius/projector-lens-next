import { name as pkgName } from 'package.json';
import { getEnv } from 'universe/backend/env';
import { getSystemDb, closeDbClient } from 'universe/backend/db';
import { AppError } from 'universe/backend/error';
import debugFactory from 'debug';

import type { WithId } from 'mongodb';
import type { RequestLogEntry } from 'types/global';

// * By default, external scripts should be silent. Use the DEBUG environment
// * variable to see relevant output

const debug = debugFactory(`${pkgName}:prune-logs`);

// ? Unnecessary when importing from universe/backend/env
//debug(`pkgName: "${pkgName}"`);
//debug(`pkgVersion: "${pkgVersion}"`);

const invoked = async () => {
  const { PRUNE_LOGS_MAX_LOGS } = getEnv();

  debug(`PRUNE_LOGS_MAX_LOGS: ${PRUNE_LOGS_MAX_LOGS}`);

  if (!PRUNE_LOGS_MAX_LOGS || !(Number(PRUNE_LOGS_MAX_LOGS) > 0))
    throw new AppError('illegal environment detected, check environment variables');

  const db = await getSystemDb({ external: true });

  debug('running delete operation on request-log');

  const requestLog = db.collection<WithId<RequestLogEntry>>('request-log');
  const cursor = requestLog.find().sort({ _id: -1 }).skip(PRUNE_LOGS_MAX_LOGS).limit(1);
  const thresholdEntry = await cursor.next();

  if (thresholdEntry) {
    const result = await requestLog.deleteMany({ _id: { $lte: thresholdEntry._id } });
    debug(`pruned ${result.deletedCount} request-log entries`);
  } else debug('found no entries to prune');

  await cursor.close();
  await closeDbClient();

  debug('execution complete');
};

export default invoked().catch((e: Error | string) => {
  debug.extend('error')(typeof e == 'string' ? e : e.message);
  process.exit(2);
});
