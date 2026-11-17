import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

type IslamicPatternProps = {
  color: string;
  /** 0..1. Keep it faint: the pattern is decoration, not content. */
  opacity?: number;
  /** Size of one tile in points. */
  size?: number;
  style?: ViewStyle;
};

/**
 * Eight-point star tiling (khatam) drawn as thin lines.
 * Fills its parent; place it absolutely behind content.
 */
export const IslamicPattern = memo(function IslamicPattern({ color, opacity = 0.08, size = 56, style }: IslamicPatternProps) {
  const s = size;
  const c = s / 2;
  const r = s * 0.42;
  const k = r * 0.4142; // tan(22.5°): inner points of the star

  // Two overlapping squares (0° and 45°) form the eight-point star.
  const square = `M ${c - r} ${c - r} H ${c + r} V ${c + r} H ${c - r} Z`;
  const diamond = `M ${c} ${c - r * 1.414} L ${c + r * 1.414} ${c} L ${c} ${c + r * 1.414} L ${c - r * 1.414} ${c} Z`;
  const inner = `M ${c - k} ${c - r} L ${c + k} ${c - r} M ${c + r} ${c - k} L ${c + r} ${c + k} M ${c + k} ${c + r} L ${c - k} ${c + r} M ${c - r} ${c + k} L ${c - r} ${c - k}`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="khatam" width={s} height={s} patternUnits="userSpaceOnUse">
            <Path d={square} stroke={color} strokeWidth={1} fill="none" opacity={opacity} />
            <Path d={diamond} stroke={color} strokeWidth={1} fill="none" opacity={opacity} />
            <Path d={inner} stroke={color} strokeWidth={1} fill="none" opacity={opacity * 0.8} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#khatam)" />
      </Svg>
    </View>
  );
});
