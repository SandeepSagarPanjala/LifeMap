import ReactNativeBlobUtil from 'react-native-blob-util';

const fs = ReactNativeBlobUtil.fs;

export async function ensureDirectory(path: string): Promise<void> {
  if (await fs.exists(path)) {
    return;
  }
  await fs.mkdir(path);
}

export async function removeDirectoryRecursive(path: string): Promise<void> {
  if (!(await fs.exists(path))) {
    return;
  }

  const stat = await fs.stat(path);
  if (stat.type !== 'directory') {
    await fs.unlink(path);
    return;
  }

  const entries = await fs.ls(path);
  for (const entry of entries) {
    await removeDirectoryRecursive(`${path}/${entry}`);
  }
  await fs.unlink(path);
}

export async function prepareEmptyDirectory(path: string): Promise<void> {
  await removeDirectoryRecursive(path);
  await ensureDirectory(path);
}
