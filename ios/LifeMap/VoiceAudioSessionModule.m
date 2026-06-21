#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VoiceAudioSessionModule, NSObject)

RCT_EXTERN_METHOD(prepareForRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
