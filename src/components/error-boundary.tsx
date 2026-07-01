import type {ComponentType, ReactNode} from 'react';
import {View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {Button} from '@/components/ui/button';
import {Text} from '@/components/ui/text';
import {Sentry} from '@/lib/monitoring';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type FeatureId = 'map' | 'capture';

type FeatureErrorBoundaryProps = {
  feature: FeatureId;
  children: ReactNode;
  onDismiss?: () => void;
};

const FEATURE_COPY: Record<FeatureId, {title: string; body: string}> = {
  map: {
    title: 'Map unavailable',
    body: 'The map hit an unexpected error. Your location history on this device is unchanged.',
  },
  capture: {
    title: 'Capture unavailable',
    body: 'The camera flow hit an unexpected error. Nothing was saved yet.',
  },
};

function ErrorFallback({
  resetError,
  title,
  body,
  onDismiss,
}: {
  resetError: () => void;
  title: string;
  body: string;
  onDismiss?: () => void;
}) {
  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="mt-3 text-center leading-6">
        {body}
      </Text>
      <Button className="mt-6" onPress={resetError}>
        Try again
      </Button>
      {onDismiss != null ? (
        <Button className="mt-3" variant="outline" onPress={onDismiss}>
          Close
        </Button>
      ) : null}
    </View>
  );
}

function RootErrorFallback({resetError}: {resetError: () => void}) {
  return (
    <ErrorFallback
      resetError={resetError}
      title="Something went wrong"
      body="LifeMap hit an unexpected error. Your data on this device is unchanged. Try again, or restart the app."
    />
  );
}

export function FeatureErrorBoundary({
  feature,
  children,
  onDismiss,
}: FeatureErrorBoundaryProps) {
  const copy = FEATURE_COPY[feature];

  return (
    <Sentry.ErrorBoundary
      beforeCapture={scope => {
        scope.setTag('feature', feature);
      }}
      fallback={({resetError}) => (
        <ErrorFallback
          resetError={resetError}
          title={copy.title}
          body={copy.body}
          onDismiss={onDismiss}
        />
      )}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

export function withFeatureErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  feature: FeatureId,
  options?: {dismissible?: boolean},
) {
  function Wrapped(props: P) {
    const navigation = useNavigation();
    const onDismiss =
      options?.dismissible === true ? () => navigation.goBack() : undefined;

    return (
      <FeatureErrorBoundary feature={feature} onDismiss={onDismiss}>
        <Component {...props} />
      </FeatureErrorBoundary>
    );
  }

  Wrapped.displayName = `WithFeatureErrorBoundary(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}

export function AppErrorBoundary({children}: AppErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={RootErrorFallback}>{children}</Sentry.ErrorBoundary>
  );
}
