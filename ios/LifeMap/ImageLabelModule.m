#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ImageLabelModule, NSObject)

RCT_EXTERN_METHOD(labelImage:(NSString *)uri
                  maxResults:(nonnull NSNumber *)maxResults
                  minConfidence:(nonnull NSNumber *)minConfidence
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
