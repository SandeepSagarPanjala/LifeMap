import { Camera } from 'lucide-react-native';

import { MapCaptureButton } from './MapCaptureButton';

type MapCameraButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapCameraButton({ bottom, onPress }: MapCameraButtonProps) {
  return (
    <MapCaptureButton
      bottom={bottom}
      variant="camera"
      icon={Camera}
      accessibilityLabel="Take a photo"
      onPress={onPress}
    />
  );
}
