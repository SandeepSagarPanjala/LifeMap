/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';

import App from './App';
import { name as appName } from './app.json';
import { handleHeadlessLocationEvent } from './src/location/transistorsoft-location-service';

BackgroundGeolocation.registerHeadlessTask(handleHeadlessLocationEvent);

AppRegistry.registerComponent(appName, () => App);
