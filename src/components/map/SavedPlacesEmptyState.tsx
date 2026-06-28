import LottieView from 'lottie-react-native';
import {StyleSheet, useWindowDimensions, View} from 'react-native';

import {Text} from '@/components/ui/text';

const FAVORITE_LOTTIE = require('../../../assets/lottie/favorite-location.json');

export function SavedPlacesEmptyState() {
  const {width, height} = useWindowDimensions();
  const lottieSize = Math.min(width * 0.42, height * 0.18, 180);

  return (
    <View style={styles.root}>
      <View style={styles.lottieWrap}>
        <LottieView
          source={FAVORITE_LOTTIE}
          autoPlay
          loop
          style={{width: lottieSize, height: lottieSize}}
        />
      </View>
      <Text className="mt-2 text-center text-sm leading-6">
        Long-press anywhere on the map to add Home, Work, or a Favorite.
      </Text>
      <Text variant="muted" className="mt-2 text-center text-sm leading-6">
        Or use Add by address at the bottom of this sheet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  lottieWrap: {
    alignItems: 'center',
  },
});
