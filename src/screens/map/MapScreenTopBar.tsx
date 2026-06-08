import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Settings} from 'lucide-react-native';
import {Pressable, StyleSheet, View} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';
import type {RootStackParamList} from '@/navigation/types';

import {
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
} from './map-screen-constants';
import {MaterializationActivityDot} from '@/components/map/MaterializationActivityDot';
import type {MapScreenController} from './use-map-screen-controller';

type MapScreenTopBarProps = {
  controller: MapScreenController;
};

export function MapScreenTopBar({controller}: MapScreenTopBarProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const {insets} = controller;
  const settingsTop = insets.top + MAP_SETTINGS_TOP_GAP;

  return (
    <View pointerEvents="box-none" style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => navigation.navigate('Settings')}
        style={[styles.settingsButton, {top: settingsTop}]}>
        <Settings size={22} color={colors.primary} strokeWidth={2.25} />
      </Pressable>
      <MaterializationActivityDot top={settingsTop + 4} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  settingsButton: {
    position: 'absolute',
    left: 16,
    width: MAP_SETTINGS_SIZE,
    height: MAP_SETTINGS_SIZE,
    borderRadius: MAP_SETTINGS_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
});
