import { name as pkgName } from 'package.json';
import debugFactory from 'debug';

import {
  run,
  mockFixtureFactory,
  dummyNpmPackageFixture,
  runnerFactory
} from 'testverse/setup';

import type { FixtureOptions } from 'testverse/setup';

// TODO: replace TEST_IDENTIFIER and EXTERNAL_BIN_PATH below with actual values
const TEST_IDENTIFIER = 'integration-externals';
const EXTERNAL_BIN_PATH = `${__dirname}/../external-scripts/bin/an-example.js`;

const debugId = `${pkgName}:*`;
const debug = debugFactory(`${pkgName}:${TEST_IDENTIFIER}`);
const runExternal = runnerFactory('node', [EXTERNAL_BIN_PATH]);

// TODO: configure automatically generated test fixtures
const fixtureOptions = {
  initialFileContents: {
    // 'package.json': `{"name":"dummy-pkg"}`
  } as FixtureOptions['initialFileContents'],
  use: [dummyNpmPackageFixture()]
};

const withMockedFixture = mockFixtureFactory(TEST_IDENTIFIER, fixtureOptions);

beforeAll(async () => {
  // TODO: test environment to ensure expected files and executables are present
  if ((await run('test', ['-e', EXTERNAL_BIN_PATH])).code != 0) {
    debug(`unable to find external executable: ${EXTERNAL_BIN_PATH}`);
    throw new Error('must build externals first (try `npm run build-externals`)');
  }
});

it(`runs silent by default`, async () => {
  expect.hasAssertions();

  await withMockedFixture(async ({ root }) => {
    const { code, stdout, stderr } = await runExternal(undefined, { cwd: root });

    expect(code).toBe(0);
    expect(stdout).toBeEmpty();
    // eslint-disable-next-line jest/no-conditional-expect
    !process.env.DEBUG && expect(stderr).toBeEmpty();
  });
});

it(`is verbose when DEBUG='${debugId}'`, async () => {
  expect.hasAssertions();

  await withMockedFixture(async ({ root }) => {
    const { code, stdout, stderr } = await runExternal(undefined, {
      env: { DEBUG: debugId, NODE_ENV: process.env.NODE_ENV },
      cwd: root
    });

    expect(code).toBe(0);
    expect(stdout).toBeEmpty();
    expect(stderr).toStrictEqual(expect.stringContaining('implement me'));
  });
});
