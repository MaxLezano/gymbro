import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../core/theme';
import { AppText } from './AppText';

export interface SheetAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}

/**
 * Bottom menu of actions. Replaces Alert.alert menus: Android alerts show at
 * most three buttons (a fourth, often "Cancelar", silently disappears) and
 * cannot be dismissed with back or a tap outside.
 */
export function ActionSheet({ visible, title, actions, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const run = (action: SheetAction) => {
    onClose();
    action.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar menú" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <View style={styles.handle} />
        <AppText variant="headline" numberOfLines={2} style={styles.title}>
          {title}
        </AppText>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={() => run(action)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name={action.icon} size={22} color={action.destructive ? theme.colors.danger : theme.colors.text} />
            <AppText variant="body" style={[styles.label, action.destructive && styles.destructive]}>
              {action.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <AppText variant="body" align="center" style={styles.cancelLabel}>
            Cancelar
          </AppText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
    marginTop: theme.spacing.sm,
  },
  title: {
    paddingVertical: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.hitTarget,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  label: {
    flex: 1,
  },
  destructive: {
    color: theme.colors.danger,
  },
  cancel: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  cancelLabel: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
