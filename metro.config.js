const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const { withSentryConfig } = require('@sentry/react-native/metro');

const config = mergeConfig(getDefaultConfig(__dirname), {});

module.exports = withSentryConfig(
  withNativeWind(config, { input: './global.css' }),
);
