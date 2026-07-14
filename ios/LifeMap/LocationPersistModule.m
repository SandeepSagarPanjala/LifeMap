#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LocationPersistModule, NSObject)

RCT_EXTERN_METHOD(startNativeTracking:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopNativeTracking:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(insertLocation:(nonnull NSNumber *)timestampMs
                  lat:(nonnull NSNumber *)lat
                  lng:(nonnull NSNumber *)lng
                  accuracy:(nonnull NSNumber *)accuracy
                  altitude:(nonnull NSNumber *)altitude
                  speed:(nonnull NSNumber *)speed
                  source:(nonnull NSString *)source
                  extras:(NSDictionary *)extras
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(drainTransistorQueue:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(syncGeofences:(nonnull NSArray *)specs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getNativePersistStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
