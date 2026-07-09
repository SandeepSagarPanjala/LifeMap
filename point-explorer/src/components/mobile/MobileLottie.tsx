import Lottie from 'lottie-react';
import type { CSSProperties } from 'react';

type MobileLottieProps = {
  animationData: object;
  className?: string;
  style?: CSSProperties;
};

export function MobileLottie({
  animationData,
  className,
  style,
}: MobileLottieProps) {
  return (
    <Lottie
      animationData={animationData}
      loop
      autoplay
      className={className}
      style={style}
    />
  );
}
