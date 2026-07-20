module.exports = api => {
  // Jest sets BABEL_ENV=test. Skip the React Compiler there: it injects `_c`
  // cache slots into functions, and babel-plugin-jest-hoist rejects those as
  // out-of-scope references inside `jest.mock()` factories (jest.setup.js).
  const isTest = api.env('test');
  api.cache.using(() => isTest);

  return {
    presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
    plugins: [
      ...(!isTest
        ? [
            // Must run first: the compiler needs the original source before other
            // transforms rewrite it.
            'babel-plugin-react-compiler',
          ]
        : []),
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@lifemap/segmentation': './packages/segmentation/src',
          },
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        },
      ],
      // Must stay last (Reanimated's worklet transform requirement).
      'react-native-reanimated/plugin',
    ],
  };
};
