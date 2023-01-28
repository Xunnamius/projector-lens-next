import type { NextApiResponse } from 'next';
import type { HttpStatusCode, SuccessJson, ErrorJson } from 'types/global';

export function sendGenericHttpResponse(
  res: NextApiResponse,
  statusCode: HttpStatusCode,
  responseJson?: Record<string, unknown>
) {
  res.status(statusCode).send(responseJson || {});
}

export function sendHttpSuccessResponse(
  res: NextApiResponse,
  statusCode: HttpStatusCode,
  responseJson?: Record<string, unknown>
) {
  const json: SuccessJson = { ...responseJson, success: true };
  sendGenericHttpResponse(res, statusCode, json);
  return json;
}

export function sendHttpErrorResponse(
  res: NextApiResponse,
  statusCode: HttpStatusCode,
  responseJson: Record<string, unknown> & { error: string }
) {
  const json: ErrorJson = { ...responseJson, success: false };
  sendGenericHttpResponse(res, statusCode, json);
  return json;
}

export function sendHttpOk(res: NextApiResponse, responseJson?: Record<string, unknown>) {
  sendHttpSuccessResponse(res, 200, responseJson);
}

export function sendHttpBadRequest(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 400, {
    error: 'request was malformed or otherwise bad',
    ...responseJson
  });
}

export function sendHttpUnauthenticated(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 401, {
    error: 'session is not authenticated',
    ...responseJson
  });
}

export function sendHttpUnauthorized(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 403, {
    error: 'session is not authorized',
    ...responseJson
  });
}

export function sendHttpNotFound(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 404, {
    error: 'resource was not found',
    ...responseJson
  });
}

export function sendHttpBadMethod(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 405, {
    error: 'bad method',
    ...responseJson
  });
}

export function sendHttpTooLarge(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 413, {
    error: 'request body is too large',
    ...responseJson
  });
}

export function sendHttpRateLimited(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 429, {
    error: 'session is rate limited',
    ...responseJson
  });
}

export function sendHttpError(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 500, {
    error: '🤯 something unexpected happened on our end 🤯',
    ...responseJson
  });
}

export function sendNotImplementedError(
  res: NextApiResponse,
  responseJson?: Record<string, unknown>
) {
  sendHttpErrorResponse(res, 501, {
    error: 'this endpoint has not yet been implemented',
    ...responseJson
  });
}
