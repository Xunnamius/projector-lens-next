// * Every now and then, we adopt best practices from CRA
// * https://tinyurl.com/yakv4ggx

const debug = require('debug')(`${require('./package.json').name}:babel-config`);

// ? This is pretty good, I think: covers popular old browsers and brand new
// ? browsers so long as they're not dead browsers
const targets = '>0.2% or last 2 versions, not dead';

// ? Fix relative local imports referencing package.json (.dist/esm/...)
const transformRenameImport = [
  'transform-rename-import',
  {
    replacements: [{ original: '../package.json', replacement: '../../package.json' }]
  }
];

// ? Next.js-specific Babel settings
const nextBabelPreset = [
  'next/babel',
  {
    'preset-env': {
      targets: targets,

      // ? If users import all core-js they're probably not concerned with
      // ? bundle size. We shouldn't rely on magic to try and shrink it.
      useBuiltIns: false,

      // ? Do not transform modules to CJS
      // ! MUST BE FALSE (see: https://nextjs.org/docs/#customizing-babel-config)
      modules: false,

      // ? Exclude transforms that make all code slower
      exclude: ['transform-typeof-symbol']
    },
    'class-properties': {
      // ? Justification: https://github.com/facebook/create-react-app/issues/4263
      loose: true
    },
    'preset-typescript': {
      allowDeclareFields: true
    }
  }
];

module.exports = {
  parserOpts: { strictMode: true },
  plugins: [
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-function-bind',
    '@babel/plugin-transform-typescript'
  ],
  // ? Sub-keys under the "env" config key will augment the above
  // ? configuration depending on the value of NODE_ENV and friends. Default
  // ? is: development
  env: {
    // * Used by Vercel, `npm run build`, and `npm start`
    production: {
      // ? Source maps are handled by Next.js and Webpack
      presets: [nextBabelPreset]
    },
    // * Used by `npm run dev`; is also the default environment
    development: {
      // ? Source maps are handled by Next.js and Webpack
      presets: [nextBabelPreset],
      // ? https://reactjs.org/docs/error-boundaries.html#how-about-event-handlers
      plugins: ['@babel/plugin-transform-react-jsx-source']
    },
    // * Used by Jest and `npm test`
    test: {
      sourceMaps: 'both',
      presets: [
        ['@babel/preset-env', { targets: { node: true } }],
        '@babel/preset-react',
        ['@babel/preset-typescript', { allowDeclareFields: true }]
        // ? We don't care about minification
      ]
    },
    // * Used by `npm run build-externals`
    external: {
      presets: [
        ['@babel/preset-env', { targets: { node: true } }],
        ['@babel/preset-typescript', { allowDeclareFields: true }]
        // ? Webpack will handle minification
      ],
      plugins: [transformRenameImport]
    }
  }
};

debug('exports: %O', module.exports);
