import React from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { Chip } from '../../components/ui';
import { BODY_PART_FILTERS, FAVORITES_FILTER, RECENT_FILTER } from './useExerciseSearch';

type Filter = { id: string; label: string; icon?: keyof typeof Ionicons.glyphMap };

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        selectionColor={theme.colors.primary}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={12} onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function BodyPartFilterRow({
  value,
  onChange,
  leading,
  favoritesCount = 0,
  recentsCount = 0,
}: {
  value: string;
  onChange: (id: string) => void;
  leading?: React.ReactNode;
  /** The athlete's own lists appear right after "Todos" when they have something in them. */
  favoritesCount?: number;
  recentsCount?: number;
}) {
  const [all, ...bodyParts] = BODY_PART_FILTERS;
  const data: Filter[] = [
    all,
    ...(favoritesCount > 0 ? [{ id: FAVORITES_FILTER, label: 'Favoritos', icon: 'star' as const }] : []),
    ...(recentsCount > 0 ? [{ id: RECENT_FILTER, label: 'Recientes', icon: 'time-outline' as const }] : []),
    ...bodyParts,
  ];
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      ListHeaderComponent={leading ? <View style={styles.leading}>{leading}</View> : null}
      renderItem={({ item }) => <Chip label={item.label} icon={item.icon} selected={value === item.id} onPress={() => onChange(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 46,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  chips: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  leading: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: theme.colors.border,
  },
});
