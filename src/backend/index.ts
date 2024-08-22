import { getEnv } from 'universe/backend/env';
import { getDb, getSystemDb } from 'universe/backend/db';
import { fetch, unfetch } from 'isomorphic-json-fetch';
import { getClientIp } from 'request-ip';
import { Octokit } from '@octokit/rest';

import { KeyTypeError } from 'universe/backend/error';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { WithId } from 'mongodb';
import type { AnyRecord } from '@ergodark/next-types';

import type {
  NextParamsRR,
  RequestLogEntry,
  LimitedLogEntry,
  ApiKey
} from 'types/global';

export const MIN_RESULT_PER_PAGE = 15;
export const NULL_KEY = '00000000-0000-0000-0000-000000000000';
export const DUMMY_KEY = '12349b61-83a7-4036-b060-213784b491';

export async function isKeyAuthentic(key: string) {
  if (!key || typeof key != 'string') throw new KeyTypeError();

  return !!(await (await getSystemDb())
    .collection<WithId<ApiKey>>('keys')
    .find({ key })
    .limit(1)
    .count());
}

/**
 * Note that this async function does not have to be awaited. It's fire and
 * forget!
 */
export async function addToRequestLog<ResponseType = AnyRecord>({
  req,
  res
}: NextParamsRR<ResponseType>) {
  const logEntry: RequestLogEntry = {
    ip: getClientIp(req),
    key: req.headers?.key?.toString() || null,
    method: req.method || null,
    route: req.url?.replace(/^\/api\//, '') || null,
    resStatusCode: res.statusCode,
    time: Date.now()
  };

  await (await getSystemDb())
    .collection<WithId<RequestLogEntry>>('request-log')
    .insertOne(logEntry);
}

export async function isRateLimited(req: NextApiRequest) {
  const ip = getClientIp(req);
  const key = req.headers?.key?.toString() || null;

  const limited =
    (
      await (await getSystemDb())
        .collection<WithId<LimitedLogEntry>>('limited-log-mview')
        .find({
          $or: [...(ip ? [{ ip }] : []), ...(key ? [{ key }] : [])],
          until: { $gt: Date.now() }
        })
        .sort({ until: -1 })
        .limit(1)
        .toArray()
    )[0] || null;

  return {
    limited: !!limited,
    retryAfter: (limited?.until || Date.now()) - Date.now()
  };
}

export async function sendBadgeSvgResponse(
  res: NextApiResponse<ReadableStream<Uint8Array> | null>,
  {
    label,
    message,
    color,
    labelColor
  }: {
    label?: string;
    message?: string;
    color?: string;
    labelColor?: string;
  }
) {
  const resp = await unfetch(
    'https://img.shields.io/static/v1?' +
      (label ? `&label=${label}` : '') +
      (message ? `&message=${message}` : '') +
      (color ? `&color=${color}` : '') +
      (labelColor ? `&labelColor=${labelColor}` : '')
  );

  res.setHeader('content-type', 'image/svg+xml;charset=utf-8');
  res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate');
  res.status(resp.ok ? 200 : 500).send(resp.body);
}

export async function getLockedVersion() {
  const pkgData = (
    await fetch.get<{
      'dist-tags': { latest: string };
      versions: { [version: string]: { dependencies: { next: string } } };
    }>('https://registry.npmjs.org/next-test-api-route-handler')
  ).json;

  return !pkgData
    ? null
    : pkgData.versions[pkgData['dist-tags'].latest].dependencies.next;
}

export async function getCompatVersion() {
  return (
    (
      await (
        await getDb({
          name: 'global-api--is-next-compat'
        })
      )
        .collection<{ compat: string }>('flags')
        .findOne({})
    )?.compat || null
  );
}

export async function getNpmPackageVersion(pkgName: string) {
  const target = `https://registry.npmjs.com/${encodeURIComponent(pkgName)}/latest`;
  return (await fetch.get<{ version: string }>(target)).json?.version || null;
}

export async function getGitHubRepoTagDate({
  owner,
  repo,
  tag
}: {
  owner: string;
  repo: string;
  tag: string;
}) {
  const { repos } = new Octokit({
    ...(getEnv().GITHUB_PAT ? { auth: getEnv().GITHUB_PAT } : {}),
    userAgent: 'github.com/ergodark/api.ergodark.com'
  });

  let page = 1;
  let tags = null;
  let commit = null;

  do {
    // eslint-disable-next-line no-await-in-loop
    ({ data: tags } = await repos.listTags({
      owner: owner,
      repo: repo,
      page: page++
    }));

    ({ commit } = tags.find((val) => val.name == tag) || {});
  } while (!commit && tags.length);

  if (commit) {
    const {
      data: {
        commit: {
          author: { date: rawDate }
        }
      }
    } = await repos.getCommit({
      owner: owner,
      repo: repo,
      ref: commit.sha
    });

    const d = new Date(rawDate);
    return d.toDateString();
  }

  return null;
}
