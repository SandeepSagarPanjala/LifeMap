module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // React Compiler "Rules of React" diagnostics (eslint-plugin-react-hooks
    // v7). These surface code the compiler cannot safely optimize (bailouts)
    // or that breaks its assumptions. Kept as warnings so they guide cleanup
    // without failing `pnpm lint`; tighten to "error" once the codebase is
    // clean.
    'react-hooks/static-components': 'warn',
    'react-hooks/use-memo': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',
    'react-hooks/incompatible-library': 'warn',
    'react-hooks/immutability': 'warn',
    'react-hooks/globals': 'warn',
    'react-hooks/set-state-in-render': 'warn',
    'react-hooks/purity': 'warn',
    'react-hooks/error-boundaries': 'warn',
    // High-volume in React Native (imperative native refs, data-loading
    // effects) and mostly intentional here. Left off to keep lint output
    // readable — turn on for a focused compiler-adoption cleanup pass.
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
  },
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**/*', '**/*.test.{js,ts,tsx}'],
      env: {
        jest: true,
      },
    },
    {
      files: ['e2e/**/*.js'],
      env: {
        jest: true,
      },
      globals: {
        device: 'readonly',
        element: 'readonly',
        by: 'readonly',
        waitFor: 'readonly',
      },
    },
  ],
};
