import React, { useCallback, useMemo, useState } from 'react';
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
import { useExerciseCollections } from './useExerciseCollections';
import { pickerBridge } from './pickerBridge';

const ITEM_HEIGHT = EXERCISE_ROW_HEIGHT + StyleSheet.hairlineWidth;

export function ExercisePickerScreen({
  mode,
  replaceIndex,
  initialBodyPart,
}: {
  mode: 'workout' | 'builder';
  /** Replace this exercise (of the active workout, or of the routine being edited): single choice, same muscle group preselected. */
  replaceIndex?: number;
  initialBodyPart?: string;
}) {
  const replacing = replaceIndex !== undefined;
  const profile = useAppStore(selectProfile);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState(initialBodyPart ?? 'all');
  const [onlyMine, setOnlyMine] = useState(profile.trainingLocation === 'home');
  const [selected, setSelected] = useState<string[]>([]);

  const { favorites, recents, ids, effectiveBodyPart } = useExerciseCollections(bodyPart);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const results = useExerciseSearch({ query, bodyPart: effectiveBodyPart, onlyMyEquipment: onlyMine, homeEquipment: profile.homeEquipment, ids });

  const toggle = useCallback(
    (exercise: CatalogExercise) => {
      if (replacing) {
        // One tap is the whole choice when swapping an exercise.
        FeedbackService.success();
        if (mode === 'workout') appActions.replaceExerciseInWorkout(replaceIndex, exercise.id);
        else pickerBridge.resolve([exercise.id]);
        router.back();
        return;
      }
      FeedbackService.selection();
      setSelected((prev) => (prev.includes(exercise.id) ? prev.filter((id) => id !== exercise.id) : [...prev, exercise.id]));
    },
    [replacing, replaceIndex, mode]
  );

  const renderItem = useCallback(
    ({ item }: { item: CatalogExercise }) => (
      <ExerciseRow exercise={item} onPress={toggle} selectable selected={selected.includes(item.id)} favorite={favoriteSet.has(item.id)} />
    ),
    [toggle, selected, favoriteSet]
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
      <ModalHeader title={replacing ? 'Reemplazar ejercicio' : 'Añadir ejercicios'} onClose={close} />
      <View style={styles.searchWrap}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar ejercicio" />
      </View>
      <View>
        <BodyPartFilterRow
          value={effectiveBodyPart}
          onChange={setBodyPart}
          favoritesCount={favorites.length}
          recentsCount={recents.length}
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
      {replacing ? (
        <View style={styles.footer}>
          <AppText variant="subhead" color="textSecondary" style={styles.count}>
            Toca el ejercicio que harás en su lugar. Se mantienen las series y el descanso.
          </AppText>
        </View>
      ) : (
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
      )}
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
