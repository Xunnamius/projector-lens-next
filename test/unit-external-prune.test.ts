import { getEnv } from 'universe/backend/env';
import { getSystemDb, closeDbClient } from 'universe/backend/db';
import debugFactory from 'debug';

import {
  asMockedFunction,
  mockEnvFactory,
  protectedImportFactory
} from 'testverse/setup';

import type { Debugger } from 'debug';

const EXTERNAL_PATH = '../external-scripts/prune-logs';

jest.mock('universe/backend/env');
jest.mock('universe/backend/db');
// ? This is called in universe/backend/env, so needs to be mocked early
jest.mock('debug', () => jest.fn().mockImplementation(() => () => undefined));

const withMockedEnv = mockEnvFactory({
  PRUNE_LOGS_MAX_LOGS: '100'
});

const protectedImport = protectedImportFactory(EXTERNAL_PATH);
const mockedDebug = asMockedFunction<Debugger>();
const mockedGetEnv = asMockedFunction(getEnv);
const mockedGetSystemDb = asMockedFunction(getSystemDb);
const mockedCloseDbClient = asMockedFunction(closeDbClient);
const mockedCursorNext = jest.fn(() => true);
const mockedCursorClose = jest.fn();
const mockedDeleteMany = jest.fn(() => ({
  deletedCount: -1
}));

mockedDebug.extend = asMockedFunction<Debugger['extend']>().mockReturnValue(mockedDebug);
asMockedFunction(debugFactory).mockReturnValue(mockedDebug);

mockedGetEnv.mockImplementation(
  () => (global.process.env as unknown) as ReturnType<typeof getEnv>
);

mockedGetSystemDb.mockReturnValue(
  (Promise.resolve({
    collection: () => ({
      find: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({ next: mockedCursorNext, close: mockedCursorClose })
          })
        })
      }),
      deleteMany: mockedDeleteMany
    })
  }) as unknown) as ReturnType<typeof getSystemDb>
);

afterEach(() => {
  jest.clearAllMocks();
});

it('calls invoker when imported', async () => {
  expect.hasAssertions();

  await withMockedEnv(async () => {
    await protectedImport();
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('PRUNE_LOGS_MAX_LOGS'));
  });
});

it('handles thrown error objects', async () => {
  expect.hasAssertions();

  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => {
    throw new Error('problems!');
  });

  await withMockedEnv(async () => {
    await protectedImport({ expectedExitCode: 2 });
    expect(mockedDebug).toBeCalledWith('problems!');
  });
});

it('handles thrown string errors', async () => {
  expect.hasAssertions();

  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => undefined);
  mockedDebug.mockImplementationOnce(() => {
    throw 'problems!';
  });

  await withMockedEnv(async () => {
    await protectedImport({ expectedExitCode: 2 });
    expect(mockedDebug).toBeCalledWith('problems!');
  });
});

it('throws when environment is invalid', async () => {
  expect.hasAssertions();

  await withMockedEnv(
    async () => {
      await protectedImport({ expectedExitCode: 2 });
      expect(mockedDebug).toBeCalledWith(
        expect.stringContaining('illegal environment detected')
      );
    },
    { PRUNE_LOGS_MAX_LOGS: '' }
  );
});

it('runs to completion when provided all env parameters', async () => {
  expect.hasAssertions();

  await withMockedEnv(async () => {
    await protectedImport();

    expect(mockedGetEnv).toBeCalled();
    expect(mockedGetSystemDb).toBeCalled();
    expect(mockedCursorNext).toBeCalled();
    expect(mockedDeleteMany).toBeCalled();
    expect(mockedCursorClose).toBeCalled();
    expect(mockedCloseDbClient).toBeCalled();
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('execution complete'));
  });
});

it("doesn't attempt to delete if thresholdEntry is empty", async () => {
  expect.hasAssertions();

  await withMockedEnv(async () => {
    mockedCursorNext.mockImplementationOnce(() => false);
    await protectedImport();

    expect(mockedGetEnv).toBeCalled();
    expect(mockedGetSystemDb).toBeCalled();
    expect(mockedCursorNext).toBeCalled();
    expect(mockedDeleteMany).not.toBeCalled();
    expect(mockedCursorClose).toBeCalled();
    expect(mockedCloseDbClient).toBeCalled();
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('execution complete'));
  });
});
