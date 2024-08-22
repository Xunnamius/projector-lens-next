// This webpack config is used to transpile src to dist, compile externals,
// compile executables, etc.
// ! This configuration file is NOT used by Next.js !

const { EnvironmentPlugin, DefinePlugin, BannerPlugin } = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { verifyEnvironment } = require('./expect-env');
const nodeExternals = require('webpack-node-externals');
const debug = require('debug')(`${require('./package.json').name}:webpack-config`);

let env = {};

try {
  require('fs').accessSync('.env');
  env = require('dotenv').config().parsed;
  debug('new env vars: %O', env);
} catch (e) {
  debug(`env support disabled; reason: ${e}`);
}

verifyEnvironment();

const envPlugins = [
  // ? Load our .env results as the defaults (overridden by process.env)
  new EnvironmentPlugin({ ...env, ...process.env }),
  // ? Create shim process.env for undefined vars (per my tastes!)
  new DefinePlugin({ 'process.env': '{}' })
];

const externals = [
  nodeExternals(),
  ({ request }, cb) =>
    // ? Externalize all .json imports (required as commonjs modules)
    /\.json$/.test(request) ? cb(null, `commonjs ${request}`) : cb()
];

const externalsConfig = {
  name: 'externals',
  mode: 'production',
  target: 'node',
  node: false,

  entry: {
    'an-example': `${__dirname}/external-scripts/an-example.ts`,
    'ban-hammer': `${__dirname}/external-scripts/ban-hammer.ts`,
    'prune-logs': `${__dirname}/external-scripts/prune-logs.ts`
  },

  output: {
    filename: '[name].js',
    path: `${__dirname}/external-scripts/bin`
  },

  externals,
  externalsPresets: { node: true },

  stats: {
    orphanModules: true,
    providedExports: true,
    usedExports: true
  },

  resolve: {
    extensions: ['.ts', '.wasm', '.mjs', '.cjs', '.js', '.json'],
    plugins: [
      // ? Use TypeScript's import resolution strategy (including aliases)
      new TsconfigPathsPlugin()
    ]
  },
  module: {
    rules: [{ test: /\.(ts|js)x?$/, loader: 'babel-loader', exclude: /node_modules/ }]
  },
  optimization: { usedExports: true },
  ignoreWarnings: [/critical dependency:/i],
  plugins: [
    ...envPlugins,
    // * ▼ For non-bundled externals, make entry file executable w/ shebang
    new BannerPlugin({ banner: '#!/usr/bin/env node', raw: true, entryOnly: true })
  ]
};

module.exports = [externalsConfig];
debug('exports: %O', module.exports);
