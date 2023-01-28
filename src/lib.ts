import { name as pkgName } from 'package.json';
import debugFactory from 'debug';

const debug = debugFactory(`${pkgName}:git-lib`);

/**
 * Does functionality
 */
export function functionality() {
  debug('functionality');
  // eslint-disable-next-line no-console
  console.log('hello, world!');
}
