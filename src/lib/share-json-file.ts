import { Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Share large JSON via a temp file URL instead of Share.message.
 * Putting multi-MB JSON in the share message OOM-crashes when targets
 * like Google Drive try to ingest it as text.
 */
export async function shareJsonFile(
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
  await Share.share({
    title: safeName,
    message: safeName,
    url: shareUrl,
  });
}
