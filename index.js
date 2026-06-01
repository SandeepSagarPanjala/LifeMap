/**
 * @format
 */

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';

import App from './App';
import {name as appName} from './app.json';
import {initMonitoring} from './src/lib/monitoring';

initMonitoring();

AppRegistry.registerComponent(appName, () => App);
