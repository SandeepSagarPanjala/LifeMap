import type { ComponentType } from 'react';

/** Minimal Phosphor icon props — avoids barrel import of phosphor-react-native. */
export type PhosphorIconProps = {
  size?: number;
  color?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
};

export type PhosphorIcon = ComponentType<PhosphorIconProps>;
