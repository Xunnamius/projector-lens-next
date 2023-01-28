import debugFactory from 'debug';

import {
  asMockedFunction,
  mockEnvFactory,
  protectedImportFactory
} from 'testverse/setup';

import type { Debugger } from 'debug';

// TODO: replace EXTERNAL_BIN_PATH below with its actual value
const EXTERNAL_PATH = '../external-scripts/an-example';

jest.mock('universe/backend/env');
jest.mock('universe/backend/db');
// ? This is called in universe/backend/env, so needs to be mocked early
jest.mock('debug', () => jest.fn().mockImplementation(() => () => undefined));

const withMockedEnv = mockEnvFactory({
  // TODO: define any necessary environment variables
});

const protectedImport = protectedImportFactory(EXTERNAL_PATH);
const mockedDebug = asMockedFunction<Debugger>();

mockedDebug.extend = asMockedFunction<Debugger['extend']>().mockReturnValue(mockedDebug);
asMockedFunction(debugFactory).mockReturnValue(mockedDebug);

afterEach(() => {
  jest.clearAllMocks();
});

it('calls invoker when imported', async () => {
  expect.hasAssertions();

  await withMockedEnv(async () => {
    await protectedImport();
    expect(mockedDebug).toBeCalledWith(expect.stringContaining('implement me!'));
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
