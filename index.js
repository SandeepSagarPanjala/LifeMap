/**
 * @format
 */

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';

import App from './App';
import {name as appName} from './app.json';
import {initMonitoring} from './src/lib/monitoring';
import {handleHeadlessLocationEvent} from './src/location/transistorsoft-location-service';

initMonitoring();
BackgroundGeolocation.registerHeadlessTask(handleHeadlessLocationEvent);

AppRegistry.registerComponent(appName, () => App);
