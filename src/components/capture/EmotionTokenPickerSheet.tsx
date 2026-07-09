import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  EMOTION_CONTEXT_TOKENS,
  emotionContextPrompt,
  type EmotionContextTokenId,
} from '@/lib/moments/emotion-context-tokens';
import {
  EMOTION_TOKENS,
  getEmotionToken,
  type EmotionSelection,
  type EmotionTokenId,
} from '@/lib/moments/emotion-tokens';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;

type PickerStep = 'emotion' | 'context';

type EmotionTokenPickerSheetProps = {
  visible: boolean;
  selectedEmotionId: EmotionTokenId | null;
  selectedContextId: EmotionContextTokenId | null;
  onSelect: (selection: EmotionSelection) => void;
  onClose: () => void;
  onWillClose?: () => void;
};

type StickerShape = 'circle' | 'roundedSquare';

function TokenPickerCell({
  label,
  sticker,
  tint,
  selected,
  primaryColor,
  stickerShape,
  onPress,
}: {
  label: string;
  sticker: string;
  tint: string;
  selected: boolean;
  primaryColor: string;
  stickerShape: StickerShape;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tokenCell}
    >
      <View style={styles.tokenStickerWrap}>
        <View
          style={[
            styles.tokenSticker,
            stickerShape === 'circle'
              ? styles.tokenStickerCircle
              : styles.tokenStickerSquare,
            {
              backgroundColor: tint,
              borderColor: selected ? primaryColor : 'transparent',
            },
            selected ? styles.tokenStickerSelected : styles.tokenStickerIdle,
          ]}
        >
          <Text style={styles.tokenEmoji}>{sticker}</Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.tokenLabel,
          selected ? { color: primaryColor, fontWeight: '700' } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmotionTokenCell({
  token,
  selected,
  primaryColor,
  onPress,
}: {
  token: (typeof EMOTION_TOKENS)[number];
  selected: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <TokenPickerCell
      label={token.label}
      sticker={token.sticker}
      tint={token.tint}
      selected={selected}
      primaryColor={primaryColor}
      stickerShape="circle"
      onPress={onPress}
    />
  );
}

export function EmotionTokenPickerSheet({
  visible,
  selectedEmotionId,
  selectedContextId,
  onSelect,
  onClose,
  onWillClose,
}: EmotionTokenPickerSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cellWidth =
    (windowWidth - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [step, setStep] = useState<PickerStep>('emotion');
  const [pendingEmotionId, setPendingEmotionId] =
    useState<EmotionTokenId | null>(selectedEmotionId);
  const [pendingContextId, setPendingContextId] =
    useState<EmotionContextTokenId | null>(selectedContextId);

  const pendingEmotion =
    pendingEmotionId != null ? getEmotionToken(pendingEmotionId) : null;

  useEffect(() => {
    if (visible) {
      setStep('emotion');
      setPendingEmotionId(selectedEmotionId);
      setPendingContextId(selectedContextId);
    }
  }, [selectedContextId, selectedEmotionId, visible]);

  const handleClose = () => {
    setStep('emotion');
    onClose();
  };

  const handleEmotionSelect = (emotionId: EmotionTokenId) => {
    setPendingEmotionId(emotionId);
    setStep('context');
  };

  const handleContextSelect = (contextId: EmotionContextTokenId) => {
    if (pendingEmotionId == null) {
      return;
    }
    const emotion = getEmotionToken(pendingEmotionId);
    const context = EMOTION_CONTEXT_TOKENS.find(
      token => token.id === contextId,
    )!;
    onSelect({ emotion, context });
    handleClose();
  };

  const snapPoints = ['58%'] as const;

  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex === -1) {
        onWillClose?.();
      }
    },
    [onWillClose],
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      onAnimate={handleAnimate}
      dismissKeyboardOnClose={false}
      rawChildren
      snapPoints={[...snapPoints]}
    >
      <BottomSheetView
        style={[
          styles.sheetBody,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {step === 'emotion' ? (
          <View style={styles.stepBody}>
            <View style={styles.stepHeader}>
              <Text variant="h4" className="border-0 pb-0">
                How are you feeling?
              </Text>
            </View>

            <BottomSheetFlatList
              data={EMOTION_TOKENS}
              keyExtractor={item => item.id}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              style={styles.grid}
              renderItem={({ item }) => (
                <View style={{ width: cellWidth }}>
                  <EmotionTokenCell
                    token={item}
                    selected={pendingEmotionId === item.id}
                    primaryColor={colors.primary}
                    onPress={() => handleEmotionSelect(item.id)}
                  />
                </View>
              )}
            />
          </View>
        ) : pendingEmotion ? (
          <View style={styles.stepBody}>
            <View style={styles.stepHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to emotions"
                onPress={() => setStep('emotion')}
                style={styles.backRow}
              >
                <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
                <Text style={styles.backLabel}>Back</Text>
              </Pressable>

              <View style={styles.contextHero}>
                <View
                  style={[
                    styles.contextHeroSticker,
                    { backgroundColor: pendingEmotion.tint },
                  ]}
                >
                  <Text style={styles.contextHeroEmoji}>
                    {pendingEmotion.sticker}
                  </Text>
                </View>
                <Text style={styles.contextHeroLabel}>
                  {pendingEmotion.label}
                </Text>
              </View>

              <Text variant="h4" className="border-0 pb-0 text-center">
                {emotionContextPrompt(pendingEmotion.label)}
              </Text>
            </View>

            <BottomSheetFlatList
              data={EMOTION_CONTEXT_TOKENS}
              keyExtractor={item => item.id}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              style={styles.contextGrid}
              renderItem={({ item }) => (
                <View style={{ width: cellWidth }}>
                  <TokenPickerCell
                    label={item.label}
                    sticker={item.sticker}
                    tint={item.tint}
                    selected={pendingContextId === item.id}
                    primaryColor={colors.primary}
                    stickerShape="roundedSquare"
                    onPress={() => handleContextSelect(item.id)}
                  />
                </View>
              )}
            />
          </View>
        ) : null}
      </BottomSheetView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    minHeight: 320,
  },
  stepBody: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  stepHeader: {
    flexShrink: 0,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  grid: {
    flex: 1,
    minHeight: 0,
    marginTop: 18,
    marginBottom: 8,
  },
  contextGrid: {
    flex: 1,
    minHeight: 0,
    marginTop: 12,
    marginBottom: 4,
  },
  gridContent: {
    paddingBottom: 4,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tokenStickerWrap: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenSticker: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  tokenStickerIdle: {
    borderColor: 'transparent',
  },
  tokenStickerSelected: {
    transform: [{ scale: 1.05 }],
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tokenStickerCircle: {
    borderRadius: 32,
  },
  tokenStickerSquare: {
    borderRadius: 16,
  },
  tokenEmoji: {
    fontSize: 32,
    lineHeight: Platform.OS === 'android' ? 36 : 34,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  contextHero: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  contextHeroSticker: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextHeroEmoji: {
    fontSize: 32,
    lineHeight: Platform.OS === 'android' ? 36 : 34,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  contextHeroLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
});
