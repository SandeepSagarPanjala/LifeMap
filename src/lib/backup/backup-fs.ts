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

export async function computeDirectoryBytes(
  directoryPath: string,
): Promise<number> {
  if (!(await fs.exists(directoryPath))) {
    return 0;
  }

  let total = 0;
  async function walk(relativePath: string): Promise<void> {
    const absolutePath = relativePath
      ? `${directoryPath}/${relativePath}`
      : directoryPath;
    const entries = await fs.ls(absolutePath);
    for (const entry of entries) {
      const childRelative = relativePath ? `${relativePath}/${entry}` : entry;
      const childPath = `${directoryPath}/${childRelative}`;
      const stat = await fs.stat(childPath);
      if (stat.type === 'directory') {
        await walk(childRelative);
      } else {
        total += Number(stat.size ?? 0);
      }
    }
  }

  await walk('');
  return total;
}

export async function yieldToUi(): Promise<void> {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}
