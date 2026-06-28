module.exports = {
  root: true,
  extends: '@react-native',
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
