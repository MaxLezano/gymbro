import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { AppText } from './AppText';
import { Button } from './Button';

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            FeedbackService.selection();
            onAction();
          }}
        >
          {({ pressed }) => (
            <AppText variant="subhead" color="primary" style={[styles.action, pressed && { opacity: 0.6 }]}>
              {actionLabel}
            </AppText>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatTile
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  unit,
  icon,
  iconColor = theme.colors.primary,
  caption,
  style,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.statTile, style]} accessible accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}>
      <View style={styles.statLabelRow}>
        {icon && <Ionicons name={icon} size={14} color={iconColor} />}
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flexShrink}>
          {label}
        </AppText>
      </View>
      <View style={styles.statValueRow}>
        <AppText variant="title" style={styles.tabular} numberOfLines={1} adjustsFontSizeToFit>
          {/* Decimal comma, like the rest of the app ("22,2", not "22.2"). */}
          {typeof value === 'number' ? value.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : value}
        </AppText>
        {unit && (
          <AppText variant="subhead" color="textMuted">
            {unit}
          </AppText>
        )}
      </View>
      {caption && (
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {caption}
        </AppText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

export function ProgressBar({
  value,
  color = theme.colors.primary,
  height = 6,
  trackColor = theme.colors.surfacePressed,
}: {
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'info';
const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: theme.colors.surfacePressed, fg: theme.colors.textSecondary },
  accent: { bg: theme.colors.primarySoft, fg: theme.colors.primary },
  success: { bg: theme.colors.successSoft, fg: theme.colors.success },
  danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
  info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
};

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = BADGE_TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={colors.fg} />}
      <AppText variant="caption" style={[styles.badgeText, { color: colors.fg }]} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={theme.colors.primary} />
      </View>
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      {message && (
        <AppText variant="callout" color="textMuted" align="center" style={styles.emptyMessage}>
          {message}
        </AppText>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="tonal" size="md" style={styles.emptyAction} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ListRow
// ---------------------------------------------------------------------------

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive,
  showChevron = true,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}) {
  const color = destructive ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={() => {
        FeedbackService.selection();
        onPress?.();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.colors.surfaceAlt }]}
    >
      {icon && (
        <View style={[styles.rowIcon, destructive && { backgroundColor: theme.colors.dangerSoft }]}>
          <Ionicons name={icon} size={18} color={destructive ? theme.colors.danger : theme.colors.primary} />
        </View>
      )}
      <View style={styles.rowTexts}>
        <AppText variant="callout" style={{ color, fontWeight: '600' }} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </AppText>
        )}
      </View>
      {value && (
        <AppText variant="subhead" color="textSecondary" numberOfLines={1}>
          {value}
        </AppText>
      )}
      {onPress && showChevron && <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  action: {
    fontWeight: '600',
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyMessage: {
    maxWidth: 300,
  },
  emptyAction: {
    marginTop: theme.spacing.md,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
});
