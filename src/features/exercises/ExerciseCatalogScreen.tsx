import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { AppText, Chip, Divider, EmptyState, ScreenHeader } from '../../components/ui';
import { TabScreen } from '../../components/layout/TabScreen';
import { HeaderActions } from '../../components/layout/HeaderActions';
import { EXERCISE_COUNT, type CatalogExercise } from '../../data/catalog';
import { selectProfile, useAppStore } from '../../state/appStore';
import { EXERCISE_ROW_HEIGHT, ExerciseRow } from './ExerciseRow';
import { BodyPartFilterRow, SearchField } from './ExerciseFilters';
import { useExerciseSearch } from './useExerciseSearch';

const ITEM_HEIGHT = EXERCISE_ROW_HEIGHT + StyleSheet.hairlineWidth;

export function ExerciseCatalogScreen() {
  const profile = useAppStore(selectProfile);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState('all');
  const [onlyMine, setOnlyMine] = useState(profile.trainingLocation === 'home');

  const results = useExerciseSearch({
    query,
    bodyPart,
    onlyMyEquipment: onlyMine,
    homeEquipment: profile.homeEquipment,
  });

  const openExercise = useCallback((exercise: CatalogExercise) => {
    router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CatalogExercise }) => <ExerciseRow exercise={item} onPress={openExercise} />,
    [openExercise]
  );

  return (
    <TabScreen>
      <ScreenHeader title="Ejercicios" subtitle={`${EXERCISE_COUNT.toLocaleString('es-ES')} movimientos con técnica guiada`} right={<HeaderActions />} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por nombre, músculo o equipo" />
      <View>
        <BodyPartFilterRow
          value={bodyPart}
          onChange={setBodyPart}
          leading={<Chip label="Mi equipo" icon="home-outline" selected={onlyMine} onPress={() => setOnlyMine((v) => !v)} />}
        />
      </View>
      <View style={styles.countRow}>
        <AppText variant="caption" color="textMuted">
          {results.length.toLocaleString('es-ES')} resultados
        </AppText>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={9}
        removeClippedSubviews
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Sin resultados"
            message={onlyMine ? 'Prueba quitando el filtro "Mi equipo" o agrega equipo en tu perfil.' : 'Prueba con otro término o grupo muscular.'}
            actionLabel={onlyMine ? 'Ver todo el catálogo' : undefined}
            onAction={onlyMine ? () => setOnlyMine(false) : undefined}
          />
        }
      />
    </TabScreen>
  );
}

function Separator() {
  return <Divider inset={theme.spacing.lg + 56 + theme.spacing.md} />;
}

const styles = StyleSheet.create({
  countRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  list: {
    paddingBottom: theme.spacing.xxl,
  },
});
