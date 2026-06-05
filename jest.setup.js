jest.mock('@rn-primitives/portal', () => ({
  PortalHost: () => null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-gesture-handler', () => {
  const {View} = require('react-native');
  const gesture = () => ({
    minDistance: () => gesture(),
    runOnJS: () => gesture(),
    onBegin: () => gesture(),
    onUpdate: () => gesture(),
    onFinalize: () => gesture(),
  });
  return {
    GestureHandlerRootView: View,
    GestureDetector: View,
    Gesture: {Pan: gesture},
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    NativeViewGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    ScrollView: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    Directions: {},
  };
});

jest.mock('@sentry/react-native', () => {
  return {
    init: jest.fn(),
    captureException: jest.fn(),
    ErrorBoundary: ({children}) => children,
  };
});

jest.mock('lottie-react-native', () => 'LottieView');

jest.mock('@shopify/flash-list', () => {
  const {FlatList} = require('react-native');
  return {FlashList: FlatList};
});

jest.mock('react-native-maps', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
    PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('react-native-background-geolocation', () => {
  const AuthorizationStatus = {
    NotDetermined: 0,
    Restricted: 1,
    Denied: 2,
    Always: 3,
    WhenInUse: 4,
  };

  const DesiredAccuracy = {High: -1};
  const LogLevel = {Verbose: 5, Off: 0};

  class BackgroundGeolocation {
    static AuthorizationStatus = AuthorizationStatus;
    static DesiredAccuracy = DesiredAccuracy;
    static LogLevel = LogLevel;
    static AUTHORIZATION_STATUS_ALWAYS = AuthorizationStatus.Always;
    static AUTHORIZATION_STATUS_WHEN_IN_USE = AuthorizationStatus.WhenInUse;
    static AUTHORIZATION_STATUS_DENIED = AuthorizationStatus.Denied;
    static AUTHORIZATION_STATUS_RESTRICTED = AuthorizationStatus.Restricted;

    static onLocation = jest.fn(() => ({remove: jest.fn()}));
    static onMotionChange = jest.fn(() => ({remove: jest.fn()}));
    static onHeartbeat = jest.fn(() => ({remove: jest.fn()}));
    static getCurrentPosition = jest.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      coords: {
        latitude: 33.21,
        longitude: -97.13,
        accuracy: 10,
        altitude: 0,
        speed: 0,
      },
    });
    static ready = jest.fn().mockResolvedValue({enabled: false});
    static requestPermission = jest.fn().mockResolvedValue(AuthorizationStatus.Always);
    static getState = jest.fn().mockResolvedValue({enabled: false});
    static getProviderState = jest.fn().mockResolvedValue({status: AuthorizationStatus.Always});
    static start = jest.fn().mockResolvedValue(undefined);
    static stop = jest.fn().mockResolvedValue(undefined);
    static setConfig = jest.fn().mockResolvedValue(undefined);
  }

  return {
    __esModule: true,
    default: BackgroundGeolocation,
  };
});

jest.mock('react-native-svg', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
    Rect: View,
  };
});
