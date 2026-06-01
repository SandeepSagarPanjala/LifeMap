import type {ReactNode} from 'react';
import {View} from 'react-native';

import {Button} from '@/components/ui/button';
import {Text} from '@/components/ui/text';
import {Sentry} from '@/lib/monitoring';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

function ErrorFallback({resetError}: {resetError: () => void}) {
  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <Text variant="h3" className="text-center">
        Something went wrong
      </Text>
      <Text variant="muted" className="mt-3 text-center leading-6">
        LifeMap hit an unexpected error. Your data on this device is unchanged. Try again, or
        restart the app.
      </Text>
      <Button className="mt-6" onPress={resetError}>
        Try again
      </Button>
    </View>
  );
}

export function AppErrorBoundary({children}: AppErrorBoundaryProps) {
  return <Sentry.ErrorBoundary fallback={ErrorFallback}>{children}</Sentry.ErrorBoundary>;
}
