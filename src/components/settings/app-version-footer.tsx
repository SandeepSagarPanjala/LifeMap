import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { getAppVersionLabel } from '@/lib/app-version';

export function AppVersionFooter() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getAppVersionLabel().then(next => {
      if (!cancelled) {
        setLabel(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (label.length === 0) {
    return null;
  }

  return (
    <Text className="text-muted-foreground mt-6 text-center text-xs">
      {label}
    </Text>
  );
}
