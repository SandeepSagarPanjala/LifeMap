import { Alert, Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * RN still ships Clipboard at runtime; public TypeScript types omit the
 * deprecated export (moved to `@react-native-clipboard/clipboard`).
 */
function copyTextToClipboard(content: string): void {
  const { Clipboard } = require('react-native') as {
    Clipboard?: { setString?: (value: string) => void };
  };
  if (typeof Clipboard?.setString !== 'function') {
    throw new Error('Clipboard is unavailable on this build.');
  }
  Clipboard.setString(content);
}

async function shareJsonAsFile(
  filename: string,
  json: string,
): Promise<void> {
  const safeName = filename.replace(/[^\w.-]+/g, '_');
  const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeName}`;

  if (await ReactNativeBlobUtil.fs.exists(filePath)) {
    await ReactNativeBlobUtil.fs.unlink(filePath);
  }

  await ReactNativeBlobUtil.fs.writeFile(filePath, json, 'utf8');

  const shareUrl = Platform.OS === 'ios' ? filePath : `file://${filePath}`;
  // Avoid putting the filename in `message` on iOS — Copy uses message and
  // would paste the path. Android Share still expects a message field.
  await Share.share(
    Platform.OS === 'ios'
      ? { title: safeName, url: shareUrl }
      : { title: safeName, message: safeName, url: shareUrl },
  );
}

/**
 * Ask whether to copy raw JSON (for pasting) or share a temp file
 * (Google Drive, Files, …). Large JSON in Share.message OOMs Drive.
 */
export async function shareJsonFile(
  filename: string,
  json: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    Alert.alert(
      'Export JSON',
      'Copy the JSON text, or share a file for Google Drive / Files.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: 'Copy JSON',
          onPress: () => {
            try {
              copyTextToClipboard(json);
              resolve();
              setTimeout(() => {
                Alert.alert('Copied', 'JSON copied to the clipboard.');
              }, 300);
            } catch (error) {
              resolve();
              setTimeout(() => {
                Alert.alert(
                  'Copy unavailable',
                  'Clipboard is not available on this build. Use Share file instead.',
                );
              }, 300);
            }
          },
        },
        {
          text: 'Share file',
          onPress: () => {
            void shareJsonAsFile(filename, json).then(resolve, reject);
          },
        },
      ],
    );
  });
}
