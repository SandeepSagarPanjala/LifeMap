import {NotebookPen} from 'lucide-react-native';

import {MapCaptureButton} from './MapCaptureButton';

type MapNoteButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapNoteButton({bottom, onPress}: MapNoteButtonProps) {
  return (
    <MapCaptureButton
      bottom={bottom}
      variant="note"
      icon={NotebookPen}
      accessibilityLabel="Write a note"
      onPress={onPress}
    />
  );
}
