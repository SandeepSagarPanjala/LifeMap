import type {StyleProp, ViewStyle} from 'react-native';
import Video, {ResizeMode} from 'react-native-video';

type MomentVideoPlayerProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  paused?: boolean;
  repeat?: boolean;
  resizeMode?: ResizeMode;
};

export function MomentVideoPlayer({
  uri,
  style,
  paused = false,
  repeat = true,
  resizeMode = ResizeMode.CONTAIN,
}: MomentVideoPlayerProps) {
  return (
    <Video
      source={{uri}}
      style={style}
      resizeMode={resizeMode}
      paused={paused}
      repeat={repeat}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
    />
  );
}
