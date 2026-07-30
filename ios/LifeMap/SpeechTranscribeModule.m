#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SpeechTranscribeModule, NSObject)

RCT_EXTERN_METHOD(transcribeFile:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
