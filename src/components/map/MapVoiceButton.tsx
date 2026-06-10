import {AudioLines} from 'lucide-react-native';

import {MapCaptureButton} from './MapCaptureButton';

type MapVoiceButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapVoiceButton({bottom, onPress}: MapVoiceButtonProps) {
  return (
    <MapCaptureButton
      bottom={bottom}
      variant="voice"
      icon={AudioLines}
      accessibilityLabel="Record a voice memo"
      onPress={onPress}
    />
  );
}
