import { name as pkgName, version as pkgVersion, bin as pkgBin } from 'package.json';
import sjx from 'shelljs';
import debugFactory from 'debug';
import uniqueFilename from 'unique-filename';
import del from 'del';

const TEST_IDENTIFIER = 'integration-client';
const debug = debugFactory(`${pkgName}:${TEST_IDENTIFIER}`);
const cli = `${__dirname}/../${pkgBin['dummy-pkg-2']}`;

sjx.config.silent = !process.env.DEBUG;

if (!sjx.test('-d', './dist')) {
  debug(`unable to find main distributables dir: ${sjx.pwd()}/dist`);
  throw new Error(
    'must build distributables before running this test suite (try `npm run build-dist`)'
  );
}

debug(`pkgName: "${pkgName}"`);
debug(`pkgVersion: "${pkgVersion}"`);

let deleteRoot: () => Promise<void>;

beforeEach(async () => {
  const root = uniqueFilename(sjx.tempdir(), TEST_IDENTIFIER);
  const owd = process.cwd();

  deleteRoot = async () => {
    sjx.cd(owd);
    debug(`forcibly removing dir ${root}`);
    await del(root, { force: true });
  };

  sjx.mkdir('-p', root);

  const cd = sjx.cd(root);

  if (cd.code != 0) {
    throw new Error(`failed to mkdir/cd into ${root}: ${cd.stderr} ${cd.stdout}`);
  } else debug(`created temp root dir: ${root}`);

  debug(`directory at this point: ${sjx.exec('tree -a', { silent: true }).stdout}`);
});

afterEach(() => deleteRoot());

describe(`${pkgName} [${TEST_IDENTIFIER}]`, () => {
  it('does the right thing when called with no args', async () => {
    expect.hasAssertions();

    const cmd = `node ${cli}`;

    debug(`running command: "${cmd}"`);
    const { code, stdout } = sjx.exec(cmd);

    expect(code).toBe(0);
    expect(stdout).toInclude('hello, world');
  });
});
