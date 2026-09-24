import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeIcon?: 'close' | 'chevron-down' | 'arrow-back';
  right?: React.ReactNode;
}

/** Compact header for stacked / modal screens: close on the left, title centered. */
export function ModalHeader({ title, subtitle, onClose, closeIcon = 'close', right }: ModalHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <IconButton
          icon={closeIcon}
          variant="filled"
          size={38}
          onPress={onClose}
          accessibilityLabel={closeIcon === 'arrow-back' ? 'Volver' : 'Cerrar'}
        />
      </View>
      <View style={styles.center}>
        <AppText variant="headline" numberOfLines={1} align="center" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color="textMuted" numberOfLines={1} align="center">
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  side: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
});
