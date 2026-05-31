import type {LucideIcon, LucideProps} from 'lucide-react-native';
import * as React from 'react';

type IconProps = LucideProps & {
  as: LucideIcon;
};

function Icon({as: IconComponent, size = 16, ...props}: IconProps) {
  return <IconComponent size={size} {...props} />;
}

export {Icon};
