/**
 * Design tokens derived from the Figma design system
 * "Design system · Agentic Advantage" (node 24:3797) and the approved
 * high-fidelity frames (node 30:141), as recorded in the run's design brief.
 *
 * This is the only place literal visual values live. Components and screens
 * compose these tokens; they never carry raw colors, sizes or spacing.
 */

const palette = {
  white: '#FFFFFF',
  neutralBlack: '#222223',
  agenticPurple: '#AB1ECC',
  pinkFull: '#EEA7BF',
  forestGrey: '#52767D',
  deepNavy: '#00164E',
  sand: '#F2D894',
  deepGreen: '#11582C',
  red: '#C61632',
  orange: '#FA8545',
  blue: '#1E2FD9',
  teal: '#1A80C3',
  pink30: '#FAE5EC',
  pink15: '#FCF2F5',
  secondary: '#626063',
  divider: '#D7D4D7',
  control: '#858085',
  codeSurface: '#F8F7F8',
} as const;

export const color = {
  background: {
    canvas: palette.white,
    brand: palette.pink30,
  },
  surface: {
    default: palette.white,
    subtle: palette.pink15,
    code: palette.codeSurface,
  },
  text: {
    primary: palette.neutralBlack,
    secondary: palette.secondary,
    inverse: palette.white,
    link: palette.agenticPurple,
  },
  border: {
    subtle: palette.divider,
    control: palette.control,
    error: palette.red,
    success: palette.deepGreen,
  },
  action: {
    primary: palette.agenticPurple,
  },
  status: {
    neutral: palette.secondary,
    success: palette.deepGreen,
    error: palette.red,
  },
} as const;

export const font = {
  heading: "'Lora', Georgia, serif",
  body: "'Inclusive Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  code: "'IBM Plex Mono', 'SFMono-Regular', monospace",
} as const;

export const weight = {
  medium: 500,
  semibold: 600,
} as const;

export const tracking = {
  eyebrow: '0.08em',
} as const;

export const opacity = {
  disabled: 0.5,
} as const;

/** Lora Medium, 112% line-height. */
export const heading = {
  58: { fontSize: 58, letterSpacing: '-0.0121em', lineHeight: 1.12 },
  40: { fontSize: 40, letterSpacing: '-0.0175em', lineHeight: 1.12 },
  36: { fontSize: 36, letterSpacing: '-0.0194em', lineHeight: 1.12 },
  28: { fontSize: 28, letterSpacing: '-0.025em', lineHeight: 1.12 },
  26: { fontSize: 26, letterSpacing: '-0.0269em', lineHeight: 1.12 },
  24: { fontSize: 24, letterSpacing: '-0.0292em', lineHeight: 1.12 },
} as const;

/** Inclusive Sans Regular, 140% line-height. */
export const body = {
  18: { fontSize: 18, lineHeight: 1.4 },
  15: { fontSize: 15, lineHeight: 1.4 },
  14: { fontSize: 14, lineHeight: 1.4 },
  13: { fontSize: 13, lineHeight: 1.4 },
  12: { fontSize: 12, lineHeight: 1.4 },
} as const;

/** Inclusive Sans SemiBold. */
export const label = {
  16: { fontSize: 16, fontWeight: 600 },
  15: { fontSize: 15, fontWeight: 600 },
  14: { fontSize: 14, fontWeight: 600 },
  12: { fontSize: 12, fontWeight: 600 },
  11: { fontSize: 11, fontWeight: 600 },
} as const;

/** IBM Plex Mono. */
export const code = {
  14: { fontSize: 14, lineHeight: 1 },
  '14/22': { fontSize: 14, lineHeight: '22px' },
  12: { fontSize: 12, lineHeight: 1 },
} as const;

export const space = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export const size = {
  navItemHeight: 44,
  inputHeight: 48,
  providerRowHeight: 56,
  buttonHeight: 44,
  publicNavHeight: 128,
  workspaceHeaderHeight: 128,
  publicFooterHeight: 74,
  sidebarWidth: 240,
  brandPanelWidth: 576,
  accountCardWidth: 336,
  contentMaxWidth: 560,
  avatarSize: 60,
  iconBox: 44,
  tokenCardMinWidth: 320,
  identityListMinWidth: 420,
  desktopMinWidth: 1280,
  iconSmall: 15,
  iconMedium: 18,
  iconLarge: 20,
} as const;

export const radius = {
  pill: 100,
  circle: '50%',
  button: 4,
  input: 4,
  card: 4,
} as const;

export const focus = {
  color: palette.agenticPurple,
  width: 2,
  offset: 2,
} as const;
