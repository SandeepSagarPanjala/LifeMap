import { Activity } from 'lucide-react-native';

import { MapCaptureButton } from './MapCaptureButton';

type MapActivityButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapActivityButton({ bottom, onPress }: MapActivityButtonProps) {
  return (
    <MapCaptureButton
      bottom={bottom}
      variant="activity"
      icon={Activity}
      accessibilityLabel="Log an activity"
      onPress={onPress}
    />
  );
}
