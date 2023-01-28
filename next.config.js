const { withBundleAnalyzer } = require('@next/bundle-analyzer');
const { verifyEnvironment } = require('./expect-env');
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

module.exports = () => {
  return withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true'
  })({
    // ? Renames the build dir "build" instead of ".next"
    distDir: 'build',

    // ? Customize the webpack configuration
    // ! Note that the webpack configuration is executed twice: once
    // ! server-side and once client-side!
    webpack: (config) => {
      return config;
    },

    // ? Environment variables pushed to the client
    // !! DO NOT PUT ANY SECRET ENVIRONMENT VARIABLES HERE !!
    env: {
      RESULTS_PER_PAGE: process.env.RESULTS_PER_PAGE,
      IGNORE_RATE_LIMITS: process.env.IGNORE_RATE_LIMITS,
      LOCKOUT_ALL_CLIENTS: process.env.LOCKOUT_ALL_CLIENTS,
      DISALLOWED_METHODS: process.env.DISALLOWED_METHODS,
      MAX_CONTENT_LENGTH_BYTES: process.env.MAX_CONTENT_LENGTH_BYTES
    },

    // ? Request URIs to be rewritten
    // * https://nextjs.org/docs/api-reference/next.config.js/rewrites
    async rewrites() {
      return [
        {
          source: '/:path*',
          destination: '/api/:path*'
        }
      ];
    }
  });
};
