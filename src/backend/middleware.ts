import {
  sendHttpUnauthenticated,
  sendHttpBadMethod,
  sendNotImplementedError,
  sendHttpError,
  sendHttpNotFound,
  sendHttpUnauthorized,
  sendHttpBadRequest,
  sendHttpRateLimited
} from 'universe/backend/respond';

import {
  GuruMeditationError,
  NotFoundError,
  NotAuthorizedError,
  IdTypeError,
  KeyTypeError,
  ValidationError,
  AppError
} from 'universe/backend/error';

import { isKeyAuthentic, addToRequestLog, isRateLimited } from 'universe/backend';

import { getEnv } from 'universe/backend/env';
import Cors from 'cors';

import type { NextParamsRR } from 'types/global';
import type { AnyRecord } from '@ergodark/next-types';

export const POSSIBLE_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

// TODO: filter out OPTIONS if specified?
const cors = Cors({ methods: POSSIBLE_METHODS });

/* eslint-disable @typescript-eslint/no-explicit-any */
const runCorsMiddleware = (req: any, res: any) => {
  return new Promise((resolve, reject) =>
    cors(req, res, (r: any) => (r instanceof Error ? reject : resolve)(r))
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// TODO: config.cores
export const config = {
  api: { bodyParser: { sizeLimit: getEnv().MAX_CONTENT_LENGTH_BYTES } }
};

export type EndpointConfig = {
  authRequired?: boolean;
  allowedMethods?: string[];
  cors?: AnyRecord;
};

/**
 * Generic middleware to handle any api endpoint. You can give it an empty async
 * handler function to trigger a 501 not implemented (to stub out API
 * endpoints).
 */
export async function handleEndpoint<ResponseType = AnyRecord>(
  fn: (
    params: NextParamsRR<ResponseType> & {
      meta: {
        authed: boolean;
        config: EndpointConfig;
      };
    }
  ) => Promise<void>,
  {
    req,
    res,
    group,
    config
  }: NextParamsRR<ResponseType> & {
    group: string;
    config?: EndpointConfig;
  }
) {
  const resp = res as typeof res & { $send: typeof res.send };
  // ? This will let us know if the sent method was called
  let sent = false;

  resp.$send = resp.send;
  resp.send = (...args) => {
    sent = true;
    void addToRequestLog<ResponseType>({ req, res });
    resp.$send(...args);
  };

  const { authRequired, allowedMethods } = (config = {
    authRequired: false,
    allowedMethods: POSSIBLE_METHODS,
    ...config
  });

  try {
    // ? We need to pretend that the API doesn't exist if its group is
    // ? disabled, so not even CORS responses are allowed here!
    if (getEnv().DISABLED_API_GROUPS.includes(group)) sendHttpNotFound(resp);
    else {
      await runCorsMiddleware(req, res);

      const { limited, retryAfter } = await isRateLimited(req);
      const { key } = req.headers;
      // ? If the request came from an authenticated client
      let authed = false;

      if (!getEnv().IGNORE_RATE_LIMITS && limited)
        return sendHttpRateLimited(resp, { retryAfter });

      if (
        getEnv().LOCKOUT_ALL_CLIENTS ||
        ((typeof key != 'string' || !(authed = await isKeyAuthentic(key))) &&
          authRequired)
      ) {
        return sendHttpUnauthenticated(resp);
      }

      if (
        !req.method ||
        getEnv().DISALLOWED_METHODS.includes(req.method) ||
        !allowedMethods.includes(req.method)
      ) {
        return sendHttpBadMethod(resp);
      }

      await fn({
        req,
        res: resp,
        meta: { authed, config: { ...config } }
      });

      // ? If the response hasn't been sent yet, send one now
      return void (!sent && sendNotImplementedError(resp));
    }
  } catch (error) {
    if (error instanceof GuruMeditationError)
      sendHttpError(resp, { error: 'sanity check failed (report this)' });
    else if (
      error instanceof IdTypeError ||
      error instanceof KeyTypeError ||
      error instanceof ValidationError
    ) {
      sendHttpBadRequest(resp, { ...(error.message ? { error: error.message } : {}) });
    } else if (error instanceof NotAuthorizedError) sendHttpUnauthorized(resp);
    else if (error instanceof NotFoundError) sendHttpNotFound(resp);
    else if (error instanceof AppError) sendHttpError(resp, { error: error.toString() });
    else sendHttpError(resp, { error: 'internal error (report this)' });

    // eslint-disable-next-line no-console
    getEnv().NODE_ENV != 'test' && console.error('error -', error);
  }
}
