import { getCameraLaunchErrorMessage } from '../src/lib/moments/capture-photo';

describe('capture photo', () => {
  it('returns null when the user cancels the camera', () => {
    expect(
      getCameraLaunchErrorMessage({ didCancel: true, assets: [] }),
    ).toBeNull();
  });

  it('maps permission errors to a friendly message', () => {
    expect(
      getCameraLaunchErrorMessage({
        didCancel: false,
        errorCode: 'permission',
        assets: [],
      }),
    ).toBe('Camera access is required to capture moments.');
  });

  it('prefers native error messages when present', () => {
    expect(
      getCameraLaunchErrorMessage({
        didCancel: false,
        errorMessage: 'Simulator has no camera',
        assets: [],
      }),
    ).toBe('Simulator has no camera');
  });
});
