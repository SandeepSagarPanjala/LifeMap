import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import { createActivityFromDefinition } from '@/db/repositories/activities';
import {
  ACTIVITY_CATALOG_FETCH_TIMEOUT_MS,
  ACTIVITY_CATALOG_URL,
} from '@/lib/activities/activity-catalog';
import type { ActivityDefinition } from '@/lib/activities/activity-definition';
import {
  parseActivityCatalogYaml,
  parseActivityYaml,
} from '@/lib/activities/parse-activity-yaml';

type ActivityCatalogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onInstalled: () => void;
};

type Mode = 'menu' | 'paste' | 'browse';

export function ActivityCatalogSheet({
  visible,
  onClose,
  onInstalled,
}: ActivityCatalogSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [yamlText, setYamlText] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<ActivityDefinition[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setMode('menu');
      setYamlText('');
      setBusy(false);
      setCatalog([]);
      setCatalogError(null);
      setSelected(new Set());
    }
  }, [visible]);

  const handleDismissed = useCallback(() => {
    onClose();
  }, [onClose]);

  const installDefinition = useCallback(
    async (definition: ActivityDefinition, source: 'yaml' | 'catalog') => {
      await createActivityFromDefinition(definition, source);
    },
    [],
  );

  const handlePasteInstall = useCallback(async () => {
    const parsed = parseActivityYaml(yamlText);
    if (!parsed.ok) {
      Alert.alert('Invalid activity', parsed.error);
      return;
    }
    setBusy(true);
    try {
      await installDefinition(parsed.definition, 'yaml');
      onInstalled();
      Alert.alert('Installed', `${parsed.definition.emoji} ${parsed.definition.name}`);
      sheetRef.current?.dismiss();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
    } finally {
      setBusy(false);
    }
  }, [installDefinition, onInstalled, yamlText]);

  const loadCatalog = useCallback(async () => {
    setBusy(true);
    setCatalogError(null);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      ACTIVITY_CATALOG_FETCH_TIMEOUT_MS,
    );
    try {
      const response = await fetch(ACTIVITY_CATALOG_URL, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Catalog HTTP ${response.status}`);
      }
      const text = await response.text();
      const parsed = parseActivityCatalogYaml(text);
      if (!parsed.ok) {
        setCatalogError(parsed.error);
        setCatalog([]);
        return;
      }
      setCatalog(parsed.catalog.activities);
      setSelected(new Set());
    } catch (error) {
      setCatalogError(
        errorMessageOr(
          error,
          'Could not download the catalog. Check your connection.',
        ),
      );
      setCatalog([]);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (visible && mode === 'browse' && catalog.length === 0 && !catalogError) {
      void loadCatalog();
    }
  }, [catalog.length, catalogError, loadCatalog, mode, visible]);

  const toggleSelected = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleInstallSelected = useCallback(async () => {
    const toInstall = catalog.filter((item, index) => {
      const key = item.templateId ?? `${item.name}-${index}`;
      return selected.has(key);
    });
    if (toInstall.length === 0) {
      Alert.alert('Select activities', 'Pick at least one activity to install.');
      return;
    }
    setBusy(true);
    try {
      for (const definition of toInstall) {
        await installDefinition(definition, 'catalog');
      }
      onInstalled();
      Alert.alert('Installed', `Added ${toInstall.length} activities.`);
      sheetRef.current?.dismiss();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
    } finally {
      setBusy(false);
    }
  }, [catalog, installDefinition, onInstalled, selected]);

  return (
    <View
      style={styles.host}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="activity-catalog"
          visible={visible}
          bottomSheetRef={sheetRef}
          onClose={handleDismissed}
          instantPresent
          stackBehavior="push"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          footerPadding={12}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            <Text variant="h4" className="border-0 pb-0">
              Activity templates
            </Text>
            <Text variant="muted" className="mt-1 text-sm">
              Paste YAML or download from the catalog. Templates are data only —
              never executable code.
            </Text>

            {mode === 'menu' ? (
              <View style={styles.menu}>
                <Pressable
                  style={styles.menuButton}
                  onPress={() => setMode('paste')}
                >
                  <Text style={styles.menuButtonLabel}>Paste YAML</Text>
                </Pressable>
                <Pressable
                  style={styles.menuButton}
                  onPress={() => setMode('browse')}
                >
                  <Text style={styles.menuButtonLabel}>
                    Download predefined
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'paste' ? (
              <View style={styles.section}>
                <Pressable onPress={() => setMode('menu')}>
                  <Text style={styles.back}>← Back</Text>
                </Pressable>
                <TextInput
                  value={yamlText}
                  onChangeText={setYamlText}
                  multiline
                  placeholder={'schemaVersion: 1\nname: Gym\nemoji: "🏋️"\nfields: []'}
                  placeholderTextColor="#8E8E93"
                  style={styles.yamlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[styles.primary, busy ? styles.disabled : null]}
                  disabled={busy}
                  onPress={() => void handlePasteInstall()}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryLabel}>Validate & install</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {mode === 'browse' ? (
              <View style={styles.section}>
                <Pressable onPress={() => setMode('menu')}>
                  <Text style={styles.back}>← Back</Text>
                </Pressable>
                {busy && catalog.length === 0 ? (
                  <ActivityIndicator style={{ marginTop: 16 }} />
                ) : null}
                {catalogError ? (
                  <View style={styles.section}>
                    <Text style={styles.error}>{catalogError}</Text>
                    <Pressable style={styles.menuButton} onPress={() => void loadCatalog()}>
                      <Text style={styles.menuButtonLabel}>Retry</Text>
                    </Pressable>
                  </View>
                ) : null}
                {catalog.map((item, index) => {
                  const key = item.templateId ?? `${item.name}-${index}`;
                  const isOn = selected.has(key);
                  return (
                    <Pressable
                      key={key}
                      style={[styles.catalogRow, isOn ? styles.catalogRowOn : null]}
                      onPress={() => toggleSelected(key)}
                    >
                      <Text style={styles.catalogEmoji}>{item.emoji}</Text>
                      <View style={styles.catalogMain}>
                        <Text style={styles.catalogName}>{item.name}</Text>
                        <Text style={styles.catalogMeta}>
                          {item.fields.length === 0
                            ? 'One-tap'
                            : `${item.fields.length} controls`}
                        </Text>
                      </View>
                      <Text style={styles.check}>{isOn ? '✓' : ''}</Text>
                    </Pressable>
                  );
                })}
                {catalog.length > 0 ? (
                  <Pressable
                    style={[styles.primary, busy ? styles.disabled : null]}
                    disabled={busy}
                    onPress={() => void handleInstallSelected()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryLabel}>Install selected</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </AppBottomSheet>
      </BottomSheetModalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    elevation: 12,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  menu: {
    gap: 10,
    marginTop: 8,
  },
  menuButton: {
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  section: {
    gap: 10,
    marginTop: 4,
  },
  back: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  yamlInput: {
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Menlo',
    color: '#1C1C1E',
    textAlignVertical: 'top',
  },
  primary: {
    borderRadius: 14,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  catalogRowOn: {
    backgroundColor: '#DCFCE7',
  },
  catalogEmoji: {
    fontSize: 28,
  },
  catalogMain: {
    flex: 1,
  },
  catalogName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  catalogMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  check: {
    fontSize: 18,
    color: '#166534',
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
});
