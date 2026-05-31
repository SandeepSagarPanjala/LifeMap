module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/__mocks__/styleMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@rn-primitives|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-svg|react-native-css-interop|nativewind|lucide-react-native)/)',
  ],
};
