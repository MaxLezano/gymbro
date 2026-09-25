import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { PANTRY_GROUPS } from '../../core/services/coach/mealPlan';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, Chip, ModalHeader } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';

/** "What do I have at home?": the menu is then built only from these foods. */
export function PantryScreen() {
  const profile = useAppStore(selectProfile);
  const [selected, setSelected] = useState<string[]>(() => profile.pantry ?? []);

  const toggle = (id: string) => {
    FeedbackService.selection();
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const save = () => {
    FeedbackService.success();
    appActions.patchProfile({ pantry: selected, pantryMode: selected.length > 0 });
    router.back();
  };

  return (
    <StackScreen>
      <ModalHeader title="Lo que tengo en casa" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText variant="body" color="textSecondary">
          Marca lo que tienes y armamos tu menú con eso, con las cantidades para tus macros. Si para alguna comida no alcanza, te mostramos la sugerida.
        </AppText>
        {PANTRY_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <AppText variant="headline" accessibilityRole="header">
              {group.title}
            </AppText>
            <View style={styles.chips}>
              {group.items.map((item) => (
                <Chip key={item.id} label={item.label} selected={selected.includes(item.id)} onPress={() => toggle(item.id)} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        {selected.length > 0 && <Button label="Borrar" icon="trash-outline" variant="secondary" size="lg" onPress={() => setSelected([])} />}
        <Button
          label={selected.length > 0 ? `Armar mi menú (${selected.length})` : 'Usar el menú sugerido'}
          icon="restaurant-outline"
          size="lg"
          style={styles.flex}
          onPress={save}
        />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
  },
  group: {
    gap: theme.spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
});
