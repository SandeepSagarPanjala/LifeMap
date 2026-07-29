#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface LifeMapTransistorSafe : NSObject

+ (NSArray<CLLocation *> *)drainLocations;
+ (void)forceMovingMode;

/// Builds `TSLocationRequestService`'s shared instance on the main thread.
///
/// That singleton's `dispatch_once` initializer synchronously hops to the main
/// queue. If a JS `getCurrentPosition()` reaches it first, that thread holds the
/// once-token while waiting for the main thread, and the main thread's
/// didBecomeActive handler (`TSAppState onEnterForeground` -> `changePace:`) blocks
/// on the same token — the process deadlocks and the scene-update watchdog kills it
/// with 0x8BADF00D. Call this on the main thread before React Native starts so every
/// later lookup is lock-free. No-op off the main thread.
+ (void)prewarmRequestService;

@end

NS_ASSUME_NONNULL_END
