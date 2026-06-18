import type {StyleProp, ViewStyle} from 'react-native';
import Video from 'react-native-video';

type MomentVideoPlayerProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  paused?: boolean;
  repeat?: boolean;
};

export function MomentVideoPlayer({
  uri,
  style,
  paused = false,
  repeat = true,
}: MomentVideoPlayerProps) {
  return (
    <Video
      source={{uri}}
      style={style}
      resizeMode="contain"
      paused={paused}
      repeat={repeat}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
    />
  );
}
