module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    // Must run first: the compiler needs the original source before other
    // transforms rewrite it.
    'babel-plugin-react-compiler',
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
