#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PlaceLookupModule, NSObject)

RCT_EXTERN_METHOD(lookupNearbyPlace:(double)lat
                  lng:(double)lng
                  radiusM:(double)radiusM
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
