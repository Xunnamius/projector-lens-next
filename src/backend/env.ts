import { parse as parseAsBytes } from 'bytes';
import { isServer } from 'is-server-side';
import { AppError } from 'universe/backend/error';
import { name as pkgName, version as pkgVersion } from 'package.json';
import debugFactory from 'debug';

const debug = debugFactory(`${pkgName}:webpack-config`);

debug(`pkgName: "${pkgName}"`);
debug(`pkgVersion: "${pkgVersion}"`);

export function getEnv() {
  const e = process?.env || {};
  const env = {
    NODE_VSCODE_INSPECT:
      e.TERM_PROGRAM == 'vscode' || /--debug|--inspect/.test(process.execArgv.join(' ')),
    ...(e.DEBUG ? { DEBUG: e.DEBUG } : {}),
    NODE_ENV: e.APP_ENV || e.NODE_ENV || e.BABEL_ENV || 'unknown',
    MONGODB_URI: e.MONGODB_URI || '',
    MONGODB_SYSTEM_DB: e.MONGODB_SYSTEM_DB || '',
    MONGODB_MS_PORT: !!e.MONGODB_MS_PORT ? Number(e.MONGODB_MS_PORT) : null,
    DISABLED_API_GROUPS: !!e.DISABLED_API_GROUPS ? e.DISABLED_API_GROUPS.split(',') : [],
    RESULTS_PER_PAGE: Number(e.RESULTS_PER_PAGE),
    IGNORE_RATE_LIMITS: !!e.IGNORE_RATE_LIMITS && e.IGNORE_RATE_LIMITS !== 'false',
    LOCKOUT_ALL_CLIENTS: !!e.LOCKOUT_ALL_CLIENTS && e.LOCKOUT_ALL_CLIENTS !== 'false',
    DISALLOWED_METHODS: !!e.DISALLOWED_METHODS ? e.DISALLOWED_METHODS.split(',') : [],
    MAX_CONTENT_LENGTH_BYTES: parseAsBytes(e.MAX_CONTENT_LENGTH_BYTES ?? '-Infinity'),
    EXTERNAL_SCRIPTS_MONGODB_URI: e.EXTERNAL_SCRIPTS_MONGODB_URI || e.MONGODB_URI || '',
    BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS: !!e.BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS
      ? Number(e.BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS)
      : null,
    BAN_HAMMER_MAX_REQUESTS_PER_WINDOW: !!e.BAN_HAMMER_MAX_REQUESTS_PER_WINDOW
      ? Number(e.BAN_HAMMER_MAX_REQUESTS_PER_WINDOW)
      : null,
    BAN_HAMMER_RESOLUTION_WINDOW_SECONDS: !!e.BAN_HAMMER_RESOLUTION_WINDOW_SECONDS
      ? Number(e.BAN_HAMMER_RESOLUTION_WINDOW_SECONDS)
      : null,
    BAN_HAMMER_DEFAULT_BAN_TIME_MINUTES: !!e.BAN_HAMMER_DEFAULT_BAN_TIME_MINUTES
      ? Number(e.BAN_HAMMER_DEFAULT_BAN_TIME_MINUTES)
      : null,
    BAN_HAMMER_RECIDIVISM_PUNISH_MULTIPLIER: !!e.BAN_HAMMER_RECIDIVISM_PUNISH_MULTIPLIER
      ? Number(e.BAN_HAMMER_RECIDIVISM_PUNISH_MULTIPLIER)
      : null,
    PRUNE_LOGS_MAX_LOGS: !!e.PRUNE_LOGS_MAX_LOGS ? Number(e.PRUNE_LOGS_MAX_LOGS) : null,
    HYDRATE_DB_ON_STARTUP:
      !!e.HYDRATE_DB_ON_STARTUP && e.HYDRATE_DB_ON_STARTUP !== 'false'
  };

  const mustBeGreaterThanZero = [env.RESULTS_PER_PAGE, env.MAX_CONTENT_LENGTH_BYTES];

  debug('env: %O', env);

  if (isServer()) {
    mustBeGreaterThanZero.some((v) => {
      if (typeof v != 'number' || isNaN(v) || v < 0)
        new AppError(`bad value "${v}", expected a number`);
    });
  }

  if (env.NODE_ENV == 'unknown') new AppError(`bad NODE_ENV, saw "${env.NODE_ENV}"`);
  if (env.RESULTS_PER_PAGE < 15) throw new AppError(`RESULTS_PER_PAGE must be >= 15`);
  if (isServer() && env.MONGODB_MS_PORT && env.MONGODB_MS_PORT <= 1024)
    throw new AppError(`optional environment variable MONGODB_MS_PORT must be > 1024`);

  return env;
}
