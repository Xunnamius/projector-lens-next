import { name as pkgName, version as pkgVersion } from 'package.json';
import debugFactory from 'debug';

// * By default, external scripts should be silent. Use the DEBUG environment
// * variable to see relevant output

// TODO: replace "an-example" below with actual name
const debug = debugFactory(`${pkgName}:an-example`);

debug(`pkgName: "${pkgName}"`);
debug(`pkgVersion: "${pkgVersion}"`);

const invoked = async () => {
  // TODO: implementation
  debug('implement me!');
  debug('and me!');
};

export default invoked().catch((e: Error | string) => {
  debug.extend('error')(typeof e == 'string' ? e : e.message);
  process.exit(2);
});
