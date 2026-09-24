import { Platform, TextStyle } from 'react-native';

/**
 * GymBro design tokens.
 * OLED-first dark palette with a single warm accent. Every text/background pair
 * used in the app keeps a contrast ratio >= 4.5:1 (body) and >= 3:1 (large/icons).
 */
const colors = {
  // Surfaces (lowest -> highest elevation)
  background: '#0A0A0B',
  surface: '#141416',
  surfaceAlt: '#1C1C1F',
  surfacePressed: '#26262A',
  overlay: 'rgba(0, 0, 0, 0.72)',

  // Hairlines
  border: '#26262B',
  borderStrong: '#3A3A42',

  // Text
  text: '#F5F5F7', // 18.2:1 on background, 16.9:1 on surface
  textSecondary: '#B4B4BD', // 9.6:1 on background, 8.9:1 on surface
  textMuted: '#8A8A94', // 5.8:1 on background, 5.4:1 on surface, 5.0:1 on surfaceAlt
  textDisabled: '#5C5C66',

  // Brand accent
  primary: '#FF9F0A',
  primaryPressed: '#E58C00',
  primarySoft: 'rgba(255, 159, 10, 0.12)',
  primaryBorder: 'rgba(255, 159, 10, 0.38)',
  onPrimary: '#1A0F00', // 9.2:1 on primary

  // Status
  success: '#32D74B',
  successSoft: 'rgba(50, 215, 75, 0.12)',
  danger: '#FF453A',
  dangerSoft: 'rgba(255, 69, 58, 0.12)',
  info: '#64D2FF',
  infoSoft: 'rgba(100, 210, 255, 0.12)',

  // Macros (consistent everywhere they appear)
  protein: '#FF7A6B',
  carbs: '#64D2FF',
  fat: '#FFD60A',
} as const;

const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

const typography = {
  largeTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  subhead: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  metric: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

const shadows = {
  none: {},
  raised: Platform.select({
    android: { elevation: 4 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
  }),
};

/** Minimum touch target recommended by Material & HIG. */
const hitTarget = 44;

export const theme = { colors, spacing, radius, typography, shadows, hitTarget };
export type Theme = typeof theme;
export type ThemeColor = keyof typeof colors;
