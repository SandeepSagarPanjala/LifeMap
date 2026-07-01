import {forwardRef} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import Video, {ResizeMode, type VideoRef} from 'react-native-video';

type MomentVideoPlayerProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  paused?: boolean;
  repeat?: boolean;
  resizeMode?: ResizeMode;
  onEnd?: () => void;
};

export const MomentVideoPlayer = forwardRef<VideoRef, MomentVideoPlayerProps>(
  function MomentVideoPlayer(
    {
      uri,
      style,
      paused = false,
      repeat = true,
      resizeMode = ResizeMode.CONTAIN,
      onEnd,
    },
    ref,
  ) {
    return (
      <Video
        ref={ref}
        source={{uri}}
        style={style}
        resizeMode={resizeMode}
        paused={paused}
        repeat={repeat}
        onEnd={onEnd}
        ignoreSilentSwitch="ignore"
        playInBackground={false}
      />
    );
  },
);
