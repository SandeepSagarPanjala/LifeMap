import { Platform } from 'react-native';

import {
  getDocumentDirectory,
  momentImageUri,
  momentPlayerPath,
  momentStorageRelativePath,
  normalizeMomentContentPath,
  resolveMomentContentPath,
} from '../src/lib/moments/moment-media-uri';

describe('moment media uri', () => {
  const docs = '/documents';
  const absolute = `${docs}/moments/abc.jpg`;

  it('strips file:// prefix from stored paths', () => {
    expect(normalizeMomentContentPath(`file://${absolute}`)).toBe(absolute);
  });

  it('extracts moments-relative storage paths', () => {
    expect(momentStorageRelativePath(absolute)).toBe('moments/abc.jpg');
    expect(momentStorageRelativePath('moments/abc.jpg')).toBe(
      'moments/abc.jpg',
    );
  });

  it('resolves relative paths against Documents', () => {
    expect(getDocumentDirectory()).toBe(docs);
    expect(resolveMomentContentPath('moments/abc.jpg')).toBe(absolute);
  });

  it('rebases legacy absolute paths to the current Documents dir', () => {
    const legacy =
      '/var/mobile/Containers/Data/Application/OLD/Documents/moments/abc.jpg';
    expect(resolveMomentContentPath(legacy)).toBe(absolute);
  });

  it('builds player paths without file scheme', () => {
    expect(momentPlayerPath('moments/abc.jpg')).toBe(absolute);
  });

  it('builds image uris with file scheme', () => {
    expect(momentImageUri('moments/abc.jpg')).toBe(`file://${absolute}`);
    expect(Platform.OS).toBeTruthy();
  });
});
