import { NativeModules } from 'react-native';

type AppVersionModule = {
  getVersion: () => Promise<string>;
  getBuildNumber: () => Promise<string>;
};

const nativeModule = NativeModules.AppVersionModule as
  | AppVersionModule
  | undefined;

export async function getAppVersionLabel(): Promise<string> {
  if (nativeModule?.getVersion == null || nativeModule.getBuildNumber == null) {
    return '';
  }

  const [version, build] = await Promise.all([
    nativeModule.getVersion(),
    nativeModule.getBuildNumber(),
  ]);
  return `Version ${version} (${build})`;
}
