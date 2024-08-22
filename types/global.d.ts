// ? Expose all the types from `@ergodark/next-types`
export * from '@ergodark/next-types';

/**
 * The shape of an API key.
 */
export type ApiKey = {
  owner: string;
  key: string;
};

/**
 * The shape of a request log entry.
 */
export type RequestLogEntry = {
  ip: string | null;
  key: string | null;
  route: string | null;
  method: string | null;
  resStatusCode: number;
  time: number;
};

/**
 * The shape of a limited log entry.
 */
export type LimitedLogEntry =
  | {
      until: number;
      ip: string | null;
      key?: never;
    }
  | {
      until: number;
      ip?: never;
      key: string | null;
    };
