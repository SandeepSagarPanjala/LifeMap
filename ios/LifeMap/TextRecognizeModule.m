#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TextRecognizeModule, NSObject)

RCT_EXTERN_METHOD(recognizeText:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
