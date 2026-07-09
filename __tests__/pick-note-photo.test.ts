import { getLibraryPickerErrorMessage } from '../src/lib/moments/pick-note-photo';

describe('getLibraryPickerErrorMessage', () => {
  it('returns null when the user cancels', () => {
    expect(
      getLibraryPickerErrorMessage({ didCancel: true, assets: [] }),
    ).toBeNull();
  });

  it('maps permission errors to a friendly message', () => {
    expect(
      getLibraryPickerErrorMessage({
        didCancel: false,
        errorCode: 'permission',
        assets: [],
      }),
    ).toBe('Photo library access is required to attach photos to notes.');
  });
});
