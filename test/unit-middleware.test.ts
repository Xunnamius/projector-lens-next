import { setupJestTestDb } from 'testverse/db';
import { testApiHandler } from 'next-test-api-route-handler';
import { DUMMY_KEY } from 'universe/backend';
import { mockEnvFactory, protectedImportFactory } from 'testverse/setup';
import array from 'array-range';

import {
  IdTypeError,
  KeyTypeError,
  ValidationError,
  NotAuthorizedError,
  NotFoundError,
  AppError,
  GuruMeditationError
} from 'universe/backend/error';

import type { NextApiHandler, NextApiResponse } from 'next';
import type { RequestLogEntry, LimitedLogEntry } from 'types/global';

const { getSystemDb } = setupJestTestDb();
const protectedImport = protectedImportFactory('universe/backend/middleware');
const withMockedEnv = mockEnvFactory({
  MAX_CONTENT_LENGTH_BYTES: '100',
  DISABLED_API_GROUPS: '',
  NODE_ENV: 'test',
  IGNORE_RATE_LIMITS: '',
  LOCKOUT_ALL_CLIENTS: '',
  DISALLOWED_METHODS: ''
});
const noop = async ({ res }: { res: NextApiResponse }) => res.status(200).send({});

describe('::handleEndpoint', () => {
  it('rejects requests that are too big when exporting config', async () => {
    expect.hasAssertions();

    await withMockedEnv(async () => {
      const Middleware = await protectedImport();

      const nextApiHandler = (p: NextApiHandler) => {
        const api: NextApiHandler & { config: Record<string, unknown> } = async (
          req,
          res
        ) => p(req, res);
        api.config = Middleware.config;
        return api;
      };

      await testApiHandler({
        handler: nextApiHandler((req, res) =>
          Middleware.handleEndpoint(noop, {
            group: 'noop',
            req,
            res,
            config: { allowedMethods: ['POST'] }
          })
        ),

        test: async ({ fetch }) => {
          const clientResponse = await fetch({
            method: 'POST',
            body: array(101)
              .map(() => 'x')
              .join('')
          });

          expect(clientResponse.status).toBe(413);
        }
      });
    });
  });

  it('responds with 501 not implemented if send() is not called', async () => {
    expect.hasAssertions();

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(
          async () => {
            // ...
          },
          {
            group: 'noop',
            req,
            res,
            config: { allowedMethods: ['GET'] }
          }
        ),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(501)
    });
  });

  test.todo('allows all possible methods when config.allowMethods is not specified');

  it('logs requests properly', async () => {
    expect.hasAssertions();

    const genStatus = (function* () {
      yield 502;
      yield 404;
      yield 403;
      yield 200;
    })();

    await testApiHandler({
      requestPatcher: (req) => {
        req.headers = {
          ...req.headers,
          'x-forwarded-for': '10.0.0.115',
          key: DUMMY_KEY
        };

        req.url = '/api/v1/handlerX';
      },

      handler: (req, res) =>
        Middleware.handleEndpoint(
          async ({ res }) => {
            res.status(genStatus.next().value || 0).send({});
          },
          {
            group: 'noop',
            req,
            res,
            config: { allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'] }
          }
        ),

      test: async ({ fetch }) => {
        await fetch({ method: 'GET' });
        await fetch({ method: 'POST' });
        await fetch({ method: 'PUT' });
        await fetch({ method: 'DELETE' });

        // ? Logs are added asynchronously, so let's wait a bit...
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));

        const logs = await (await getSystemDb())
          .collection<RequestLogEntry>('request-log')
          .find()
          .sort({
            time: 1
          })
          .limit(4)
          .project({
            _id: false,
            time: false
          })
          .toArray();

        expect(logs).toIncludeAllMembers([
          {
            ip: '10.0.0.115',
            key: DUMMY_KEY,
            method: 'GET',
            route: 'v1/handlerX',
            resStatusCode: 502
          },
          {
            ip: '10.0.0.115',
            key: DUMMY_KEY,
            method: 'POST',
            route: 'v1/handlerX',
            resStatusCode: 404
          },
          {
            ip: '10.0.0.115',
            key: DUMMY_KEY,
            method: 'PUT',
            route: 'v1/handlerX',
            resStatusCode: 403
          },
          {
            ip: '10.0.0.115',
            key: DUMMY_KEY,
            method: 'DELETE',
            route: 'v1/handlerX',
            resStatusCode: 200
          }
        ]);
      }
    });
  });

  it('sends 405 when encountering non-allowed methods', async () => {
    expect.hasAssertions();

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['POST', 'PUT'] }
        }),

      test: async ({ fetch }) => {
        expect((await fetch({ method: 'GET' })).status).toBe(405);
        expect((await fetch({ method: 'POST' })).status).toBe(200);
        expect((await fetch({ method: 'PUT' })).status).toBe(200);
        expect((await fetch({ method: 'DELETE' })).status).toBe(405);
      }
    });
  });

  it('sends 405 when encountering globally disallowed methods', async () => {
    expect.hasAssertions();

    process.env.DISALLOWED_METHODS = 'POST,PUT,DELETE';

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'] }
        }),

      test: async ({ fetch }) => {
        expect((await fetch({ method: 'GET' })).status).toBe(200);
        expect((await fetch({ method: 'POST' })).status).toBe(405);
        expect((await fetch({ method: 'PUT' })).status).toBe(405);
        expect((await fetch({ method: 'DELETE' })).status).toBe(405);
      }
    });
  });

  it('sends correct HTTP error codes when certain errors occur', async () => {
    expect.hasAssertions();

    const genError = (function* () {
      yield new IdTypeError();
      yield new KeyTypeError();
      yield new ValidationError();
      yield new NotAuthorizedError();
      yield new NotFoundError();
      yield new AppError();
      yield new GuruMeditationError();
    })();

    const genErrorStatus = (function* () {
      yield 400;
      yield 400;
      yield 400;
      yield 403;
      yield 404;
      yield 500;
      yield 500;
    })();

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(
          async () => {
            throw genError.next().value;
          },
          { group: 'noop', req, res, config: { allowedMethods: ['GET'] } }
        ),

      test: async ({ fetch }) => {
        let next = null;

        while (!(next = genErrorStatus.next()).done) {
          // eslint-disable-next-line no-await-in-loop
          expect((await fetch()).status).toBe(next.value);
        }
      }
    });
  });

  it('responds properly to unauthenticatable requests when config.authRequired = true', async () => {
    expect.hasAssertions();

    await testApiHandler({
      handler: (req, res) =>
        Middleware.handleEndpoint(async () => undefined, {
          group: 'noop',
          req,
          res,
          config: {
            allowedMethods: ['GET'],
            authRequired: true
          }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(401)
    });

    await testApiHandler({
      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: {
            allowedMethods: ['GET'],
            authRequired: true
          }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(401)
    });
  });

  it('treats authenticatable requests as unauthenticatable when locking out all keys', async () => {
    expect.hasAssertions();

    await testApiHandler({
      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => {
        expect((await fetch({ headers: { key: DUMMY_KEY } })).status).toBe(200);

        process.env.LOCKOUT_ALL_CLIENTS = 'true';
        expect((await fetch({ headers: { key: DUMMY_KEY } })).status).toBe(401);

        process.env.LOCKOUT_ALL_CLIENTS = 'false';
        expect((await fetch({ headers: { key: DUMMY_KEY } })).status).toBe(200);
      }
    });
  });

  it('confirm headers are automatically lowercased', async () => {
    expect.hasAssertions();

    await testApiHandler({
      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) =>
        expect(
          (
            await fetch({
              headers: { KEY: DUMMY_KEY }
            })
          ).status
        ).toBe(200)
    });
  });

  it('requests are limited in accordance with the database except when ignoring rate limits', async () => {
    expect.hasAssertions();

    const ip = '7.7.7.7';
    const key = DUMMY_KEY;
    const limitedLog = (await getSystemDb()).collection<LimitedLogEntry>(
      'limited-log-mview'
    );

    await testApiHandler({
      requestPatcher: (req) => (req.headers['x-forwarded-for'] = ip),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => {
        let entry = null;

        expect((await fetch({ headers: { key } })).status).toBe(200);

        const _now = Date.now;
        const now = Date.now();
        Date.now = () => now;

        entry = await limitedLog.insertOne({ ip, until: now + 1000 * 60 * 15 });
        const res = await fetch({ headers: { key } });
        expect(res.status).toBe(429);

        expect(await res.json()).toContainEntry<{ retryAfter: number }>([
          'retryAfter',
          1000 * 60 * 15
        ]);

        await limitedLog.deleteOne({ _id: entry.insertedId });
        expect((await fetch({ headers: { key } })).status).toBe(200);

        entry = await limitedLog.insertOne({ key, until: Date.now() + 1000 * 60 * 60 });
        expect((await fetch({ headers: { key } })).status).toBe(429);

        process.env.IGNORE_RATE_LIMITS = 'true';
        expect((await fetch({ headers: { key } })).status).toBe(200);

        process.env.IGNORE_RATE_LIMITS = 'false';
        expect((await fetch({ headers: { key } })).status).toBe(429);

        await limitedLog.deleteOne({ _id: entry.insertedId });
        expect((await fetch({ headers: { key } })).status).toBe(200);

        Date.now = _now;
      }
    });
  });

  it('does not respond if its corresponding group is disabled', async () => {
    expect.hasAssertions();

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: '1',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => {
        process.env.DISABLED_API_GROUPS = '1';
        expect((await fetch()).status).toBe(404);

        process.env.DISABLED_API_GROUPS = '2';
        expect((await fetch()).status).toBe(200);

        process.env.DISABLED_API_GROUPS = '2,1';
        expect((await fetch()).status).toBe(404);

        process.env.DISABLED_API_GROUPS = '3,2';
        expect((await fetch()).status).toBe(200);
      }
    });

    process.env.DISABLED_API_GROUPS = 'group-3,&$*%,2';

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: '1',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(200)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'group-3',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(404)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: '&$*%',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(404)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: '2',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(404)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(async () => undefined, {
          group: '2',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(404)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(200)
    });

    process.env.DISABLED_API_GROUPS = '';

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'group-3',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(200)
    });

    await testApiHandler({
      requestPatcher: (req) => (req.headers.key = DUMMY_KEY),

      handler: (req, res) =>
        Middleware.handleEndpoint(noop, {
          group: 'noop',
          req,
          res,
          config: { allowedMethods: ['GET'] }
        }),

      test: async ({ fetch }) => expect((await fetch()).status).toBe(200)
    });
  });

  it('parses url parameters as expected', async () => {
    expect.hasAssertions();

    await testApiHandler({
      requestPatcher: (req) => {
        req.url = '/?some=url&yes';
        req.headers.key = DUMMY_KEY;
      },

      handler: (req, res) =>
        Middleware.handleEndpoint(
          async ({ req, res }) => {
            expect(req.query).toStrictEqual({ some: 'url', yes: '' });
            res.status(200).send({});
          },
          {
            group: 'noop',
            req,
            res,
            config: { allowedMethods: ['GET'] }
          }
        ),

      test: async ({ fetch }) => {
        expect((await fetch()).status).toBe(200);
      }
    });
  });
});
