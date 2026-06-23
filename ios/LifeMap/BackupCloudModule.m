#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BackupCloudModule, NSObject)

RCT_EXTERN_METHOD(isCloudAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCloudBackupMetadata:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(uploadBackupDirectory:(NSString *)localPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(downloadBackupDirectory:(NSString *)localPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
