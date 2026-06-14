#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface LifeMapTransistorSafe : NSObject

+ (NSArray<CLLocation *> *)drainLocations;
+ (void)forceMovingMode;

@end

NS_ASSUME_NONNULL_END
