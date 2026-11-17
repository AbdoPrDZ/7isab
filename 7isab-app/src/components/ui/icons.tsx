/**
 * Line icons drawn with SVG, so they look the same on every phone
 * (Unicode symbols like ☾ or ⚙ depend on the device's emoji font).
 */
import Svg, { Circle, Path } from 'react-native-svg';

export type IconProps = { size?: number; color: string; strokeWidth?: number };

function Icon({ size = 20, color, strokeWidth = 2, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </Icon>
  );
}

/** "Follow the system": a half-filled circle. */
export function AutoThemeIcon({ size = 20, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill={color} stroke="none" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

/** Points to the start edge: left in LTR, right in RTL (pass `flip` for RTL). */
export function BackIcon({ flip = false, ...props }: IconProps & { flip?: boolean }) {
  return (
    <Icon {...props}>
      <Path d={flip ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
      <Path d="M12 6.5v13" />
    </Icon>
  );
}

/** Prayer beads (athkar). */
export function BeadsIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      {/* A ring of beads with a tassel. */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <Circle
          key={angle}
          cx={12 + 6.5 * Math.sin((angle * Math.PI) / 180)}
          cy={9.5 - 6.5 * Math.cos((angle * Math.PI) / 180)}
          r="1.6"
        />
      ))}
      <Path d="M12 17.5v2.5M10 22l2-2 2 2" />
    </Icon>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6.5h9M11 12.5h9M11 18.5h9" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <Path d="M4 7.5V17a2 2 0 0 0 2 2h14V9H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <Circle cx="16.5" cy="14" r="1" fill={props.color} />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 11h12v9H6z" />
      <Path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M3.5 11L12 4l8.5 7" />
      <Path d="M5.5 9.5V20h13V9.5" />
      <Path d="M10 20v-5h4v5" />
    </Icon>
  );
}

/** Balance scale (Hisab). */
export function ScaleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3v18M7 21h10M5 7h14M12 5.5a1.5 1.5 0 0 0 0-3" />
      <Path d="M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12h14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}

/** Points to the end edge (a "go into" chevron); pass `flip` in RTL. */
export function ChevronIcon({ flip = false, ...props }: IconProps & { flip?: boolean }) {
  return (
    <Icon {...props}>
      <Path d={flip ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </Icon>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 14L4 9l5-5" />
      <Path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  );
}

export function HeartHandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 9.5c-1.2-2.3-5-2.2-5 .8 0 2.3 3 4.2 5 5.7 2-1.5 5-3.4 5-5.7 0-3-3.8-3.1-5-.8z" />
      <Path d="M3 20c2-1.5 4-2 6-2h6c1.5 0 2-1 2-1.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3.5L2.5 20h19L12 3.5z" />
      <Path d="M12 10v4.5M12 17.5v.01" />
    </Icon>
  );
}

export function FingerprintIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6.5 6.5A7.5 7.5 0 0 1 19.5 11v1.5M4.5 10a7.6 7.6 0 0 1 .9-2.2M4.5 14v-3" />
      <Path d="M8 19.5c.6-1.6 1-3.4 1-5.5v-2a3 3 0 0 1 6 0v1.5M12 12v2c0 2.6-.6 5-1.7 7M15 16.5c-.2 1.5-.6 3-1.2 4.3M19 16c-.2 1-.4 2-.8 3" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}

export function AlarmIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M5 3 2 6M19 3l3 3" />
    </Icon>
  );
}
