#import "LifeMapTransistorSafe.h"
#import <CoreLocation/CoreLocation.h>

@implementation LifeMapTransistorSafe

+ (NSArray<CLLocation *> *)drainLocations {
  @try {
    Class managerClass = NSClassFromString(@"TSLocationManager");
    if (managerClass == nil) {
      return @[];
    }

    SEL sharedSelector = NSSelectorFromString(@"sharedInstance");
    if (![managerClass respondsToSelector:sharedSelector]) {
      return @[];
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    id shared = [managerClass performSelector:sharedSelector];
#pragma clang diagnostic pop

    if (shared == nil) {
      return @[];
    }

    id locationsValue = nil;
    @try {
      if ([shared respondsToSelector:@selector(locations)]) {
        locationsValue = [shared valueForKey:@"locations"];
      }
    } @catch (NSException *exception) {
      return @[];
    }

    if (![locationsValue isKindOfClass:[NSArray class]]) {
      return @[];
    }

    NSMutableArray<CLLocation *> *locations = [NSMutableArray array];
    for (id item in (NSArray *)locationsValue) {
      if ([item isKindOfClass:[CLLocation class]]) {
        [locations addObject:(CLLocation *)item];
      }
    }

    SEL destroySelector = NSSelectorFromString(@"destroyLocations");
    if ([shared respondsToSelector:destroySelector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
      [shared performSelector:destroySelector];
#pragma clang diagnostic pop
    }

    return locations;
  } @catch (NSException *exception) {
    return @[];
  }
}

+ (void)forceMovingMode {
  @try {
    Class managerClass = NSClassFromString(@"TSLocationManager");
    if (managerClass == nil) {
      return;
    }

    SEL sharedSelector = NSSelectorFromString(@"sharedInstance");
    SEL paceSelector = NSSelectorFromString(@"changePace:");
    if (![managerClass respondsToSelector:sharedSelector]) {
      return;
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    id shared = [managerClass performSelector:sharedSelector];
    if (shared != nil && [shared respondsToSelector:paceSelector]) {
      [shared performSelector:paceSelector withObject:@(YES)];
    }
#pragma clang diagnostic pop
  } @catch (NSException *exception) {
    // Transistor may not be configured yet — ignore.
  }
}

@end
