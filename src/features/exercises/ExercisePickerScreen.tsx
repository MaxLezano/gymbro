import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { AppText, Button, Chip, Divider, EmptyState, ModalHeader } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import type { CatalogExercise } from '../../data/catalog';
import { EXERCISE_ROW_HEIGHT, ExerciseRow } from './ExerciseRow';
import { BodyPartFilterRow, SearchField } from './ExerciseFilters';
import { useExerciseSearch } from './useExerciseSearch';
import { pickerBridge } from './pickerBridge';

const ITEM_HEIGHT = EXERCISE_ROW_HEIGHT + StyleSheet.hairlineWidth;

export function ExercisePickerScreen({ mode }: { mode: 'workout' | 'builder' }) {
  const profile = useAppStore(selectProfile);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState('all');
  const [onlyMine, setOnlyMine] = useState(profile.trainingLocation === 'home');
  const [selected, setSelected] = useState<string[]>([]);

  const results = useExerciseSearch({ query, bodyPart, onlyMyEquipment: onlyMine, homeEquipment: profile.homeEquipment });

  const toggle = useCallback((exercise: CatalogExercise) => {
    FeedbackService.selection();
    setSelected((prev) => (prev.includes(exercise.id) ? prev.filter((id) => id !== exercise.id) : [...prev, exercise.id]));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CatalogExercise }) => (
      <ExerciseRow exercise={item} onPress={toggle} selectable selected={selected.includes(item.id)} />
    ),
    [toggle, selected]
  );

  const close = () => {
    pickerBridge.cancel();
    router.back();
  };

  const confirm = () => {
    FeedbackService.success();
    if (mode === 'workout') appActions.addExercisesToWorkout(selected);
    else pickerBridge.resolve(selected);
    router.back();
  };

  return (
    <StackScreen>
      <ModalHeader title="Añadir ejercicios" onClose={close} />
      <View style={styles.searchWrap}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar ejercicio" />
      </View>
      <View>
        <BodyPartFilterRow
          value={bodyPart}
          onChange={setBodyPart}
          leading={<Chip label="Mi equipo" icon="home-outline" selected={onlyMine} onPress={() => setOnlyMine((v) => !v)} />}
        />
      </View>
      <FlatList
        data={results}
        extraData={selected}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg + 56 + theme.spacing.md} />}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialNumToRender={12}
        windowSize={9}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState icon="search-outline" title="Sin resultados" message="Prueba con otro término o filtro." />}
      />
      <View style={styles.footer}>
        <AppText variant="subhead" color="textSecondary" style={styles.count}>
          {selected.length === 0 ? 'Toca para seleccionar' : `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}`}
        </AppText>
        <Button
          label={selected.length > 0 ? `Añadir (${selected.length})` : 'Añadir'}
          icon="add"
          size="lg"
          disabled={selected.length === 0}
          onPress={confirm}
        />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingTop: theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  count: {
    flex: 1,
  },
});
