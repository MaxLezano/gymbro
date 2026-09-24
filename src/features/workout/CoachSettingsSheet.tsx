import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../core/theme';
import { CoachSettingsStore, SPEECH_RATES, useCoachSettings } from '../../core/services/voice/coachSettings';
import { CoachVoice, spanishVoices, type CoachVoiceOption } from '../../core/services/voice/coachVoice';
import { AppText, Chip, IconButton } from '../../components/ui';

function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant="callout" style={styles.bold}>
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {subtitle}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.surfaceAlt, true: theme.colors.primaryBorder }}
        thumbColor={value ? theme.colors.primary : theme.colors.textMuted}
        accessibilityLabel={title}
      />
    </View>
  );
}

function VoiceRow({ option, selected, onSelect }: { option: CoachVoiceOption | null; selected: boolean; onSelect: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      style={({ pressed }) => [styles.voiceRow, selected && styles.voiceRowSelected, pressed && styles.pressed]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? theme.colors.primary : theme.colors.textMuted} />
      <View style={styles.flex}>
        <AppText variant="callout" style={styles.bold}>
          {option ? option.label : 'Automática'}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {option ? option.detail : 'La voz en español del teléfono'}
        </AppText>
      </View>
      <IconButton icon="play" size={36} onPress={() => CoachVoice.preview(option?.id)} accessibilityLabel={`Probar ${option?.label ?? 'voz automática'}`} />
    </Pressable>
  );
}

/** Coach preferences: spoken prompts, auto start, speed and voice. */
export function CoachSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const settings = useCoachSettings();
  const insets = useSafeAreaInsets();
  const [voices, setVoices] = useState<CoachVoiceOption[] | null>(null);

  useEffect(() => {
    if (visible && voices === null) spanishVoices().then(setVoices);
  }, [visible, voices]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar ajustes" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <AppText variant="title">Ajustes del coach</AppText>
          <IconButton icon="close" variant="filled" size={36} onPress={onClose} accessibilityLabel="Cerrar" />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ToggleRow title="Voz del coach" subtitle="Anuncia descansos y la siguiente serie" value={settings.speak} onChange={(speak) => CoachSettingsStore.update({ speak })} />
          <ToggleRow
            title="Empezar la serie sola"
            subtitle="Al terminar el descanso arranca el cronómetro sin tocar nada"
            value={settings.autoStart}
            onChange={(autoStart) => CoachSettingsStore.update({ autoStart })}
          />

          <ToggleRow title="Tono grave" subtitle="Hace más grave cualquier voz" value={settings.deep} onChange={(deep) => CoachSettingsStore.update({ deep })} />

          <AppText variant="overline" color="textMuted" style={styles.sectionLabel}>
            Velocidad de la voz
          </AppText>
          <View style={styles.chips}>
            {SPEECH_RATES.map((rate) => (
              <Chip key={rate.value} label={rate.label} selected={settings.rate === rate.value} onPress={() => CoachSettingsStore.update({ rate: rate.value })} />
            ))}
          </View>

          <AppText variant="overline" color="textMuted" style={styles.sectionLabel}>
            Voz
          </AppText>
          <VoiceRow option={null} selected={!settings.voiceId} onSelect={() => CoachSettingsStore.update({ voiceId: undefined })} />
          {voices === null ? (
            <AppText variant="caption" color="textMuted">
              Buscando voces…
            </AppText>
          ) : voices.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              Tu teléfono no tiene más voces en español. Puedes instalarlas en Ajustes → Sistema → Idiomas → Salida de texto a voz.
            </AppText>
          ) : (
            voices.map((option) => (
              <VoiceRow
                key={option.id}
                option={option}
                // Older builds stored the concrete "-local"/"-network" id.
                selected={settings.voiceId?.replace(/-(local|network)$/i, '') === option.id}
                onSelect={() => CoachSettingsStore.update({ voiceId: option.id })}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
    marginTop: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sectionLabel: {
    marginTop: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  voiceRowSelected: {
    borderColor: theme.colors.primaryBorder,
  },
});
