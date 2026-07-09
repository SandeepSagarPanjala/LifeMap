import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { Text } from '@/components/ui/text';
import {
  momentImageUri,
  resolveExistingMomentContentPath,
} from '@/lib/moments/moment-media-uri';

type MomentPreviewImageProps = {
  contentPath: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function MomentPreviewImage({
  contentPath,
  style,
  resizeMode = 'cover',
  onPress,
  accessibilityLabel,
}: MomentPreviewImageProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const existingPath = await resolveExistingMomentContentPath(contentPath);
      if (!active) {
        return;
      }
      if (!existingPath) {
        setUri(null);
        setFailed(true);
        return;
      }
      setFailed(false);
      setUri(momentImageUri(existingPath));
    }

    void load();
    return () => {
      active = false;
    };
  }, [contentPath]);

  const loadBase64Fallback = async () => {
    try {
      const existingPath = await resolveExistingMomentContentPath(contentPath);
      if (!existingPath) {
        setFailed(true);
        return;
      }
      const data = await ReactNativeBlobUtil.fs.readFile(
        existingPath,
        'base64',
      );
      setUri(`data:image/jpeg;base64,${data}`);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  if (failed && !uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text variant="muted" className="text-sm">
          Media file missing — capture this moment again
        </Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator color="#8E8E93" />
      </View>
    );
  }

  const image = (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      accessibilityIgnoresInvertColors
      onError={() => {
        void loadBase64Fallback();
      }}
    />
  );

  if (onPress == null) {
    return image;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'View full photo'}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
});
