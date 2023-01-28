import { getEnv } from 'universe/backend/env';
import { getSystemDb, closeDbClient } from 'universe/backend/db';
import debugFactory from 'debug';

import {
  asMockedFunction,
  mockEnvFactory,
  protectedImportFactory
} from 'testverse/setup';

import type { Debugger } from 'debug';

const EXTERNAL_PATH = '../external-scripts/ban-hammer';

jest.mock('universe/backend/env');
jest.mock('universe/backend/db');
// ? This is called in universe/backend/env, so needs to be mocked early
jest.mock('debug', () => jest.fn().mockImplementation(() => () => undefined));

const withMockedEnv = mockEnvFactory({
  BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS: '100',
  BAN_HAMMER_MAX_REQUESTS_PER_WINDOW: '100',
  BAN_HAMMER_RESOLUTION_WINDOW_SECONDS: '100',
  BAN_HAMMER_DEFAULT_BAN_TIME_MINUTES: '100',
  BAN_HAMMER_RECIDIVISM_PUNISH_MULTIPLIER: '100'
});

const protectedImport = protectedImportFactory(EXTERNAL_PATH);
const mockedDebug = asMockedFunction<Debugger>();
const mockedGetEnv = asMockedFunction(getEnv);
const mockedGetSystemDb = asMockedFunction(getSystemDb);
const mockedCloseDbClient = asMockedFunction(closeDbClient);
const mockedCursorNext = jest.fn();
const mockedCursorClose = jest.fn();

mockedDebug.extend = asMockedFunction<Debugger['extend']>().mockReturnValue(mockedDebug);
asMockedFunction(debugFactory).mockReturnValue(mockedDebug);
mockedGetEnv.mockImplementation(
  () => (global.process.env as unknown) as ReturnType<typeof getEnv>
);
mockedGetSystemDb.mockReturnValue(
  (Promise.resolve({
    collection: () => ({
      aggregate: () => ({ next: mockedCursorNext, close: mockedCursorClose })
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
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('calledEverySeconds'));
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
    { BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS: '' }
  );

  await withMockedEnv(
    async () => {
      await protectedImport({ expectedExitCode: 2 });
      expect(mockedDebug).toBeCalledWith(
        expect.stringContaining('illegal environment detected')
      );
    },
    { BAN_HAMMER_MAX_REQUESTS_PER_WINDOW: '' }
  );

  await withMockedEnv(
    async () => {
      await protectedImport({ expectedExitCode: 2 });
      expect(mockedDebug).toBeCalledWith(
        expect.stringContaining('illegal environment detected')
      );
    },
    { BAN_HAMMER_RESOLUTION_WINDOW_SECONDS: '' }
  );

  await withMockedEnv(
    async () => {
      await protectedImport({ expectedExitCode: 2 });
      expect(mockedDebug).toBeCalledWith(
        expect.stringContaining('illegal environment detected')
      );
    },
    { BAN_HAMMER_DEFAULT_BAN_TIME_MINUTES: '' }
  );

  await withMockedEnv(
    async () => {
      await protectedImport({ expectedExitCode: 2 });
      expect(mockedDebug).toBeCalledWith(
        expect.stringContaining('illegal environment detected')
      );
    },
    { BAN_HAMMER_RECIDIVISM_PUNISH_MULTIPLIER: '' }
  );
});

it('runs to completion when provided all env parameters', async () => {
  expect.hasAssertions();

  await withMockedEnv(async () => {
    await protectedImport();

    expect(mockedGetEnv).toBeCalled();
    expect(mockedGetSystemDb).toBeCalled();
    expect(mockedCursorNext).toBeCalled();
    expect(mockedCursorClose).toBeCalled();
    expect(mockedCloseDbClient).toBeCalled();
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('execution complete'));
  });
});
