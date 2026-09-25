import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { askCoach, COACH_MODEL_LABEL, type CoachMessage } from '../../core/services/coach';
import { calculateNutritionPlan } from '../../core/utils/nutrition';
import { createId } from '../../core/utils/workout';
import { FeedbackService } from '../../core/services/feedback';
import { Storage } from '../../storage';
import { getAppState, selectProfile, useAppStore } from '../../state/appStore';
import { AppText, IconButton } from '../../components/ui';
import { useDictation } from './useDictation';
import { StackScreen } from '../../components/layout/TabScreen';
import { CoachBlockView } from './CoachBlocks';
import { RichText } from './RichText';

const STARTERS: { icon: keyof typeof Ionicons.glyphMap; label: string; prompt: string }[] = [
  { icon: 'barbell-outline', label: 'Rutina para hoy', prompt: 'Armame una rutina para hoy' },
  { icon: 'restaurant-outline', label: 'Menú con mis macros', prompt: 'Armame un menú de un día que cumpla mis macros' },
  { icon: 'trending-up-outline', label: 'Cómo progresar', prompt: '¿Cómo progreso en mis ejercicios?' },
  { icon: 'body-outline', label: 'Mi composición', prompt: '¿Cómo está mi composición corporal?' },
  { icon: 'swap-horizontal-outline', label: 'Alternativas', prompt: 'Dame ejercicios de espalda para hacer en casa' },
  { icon: 'help-buoy-outline', label: 'Técnica', prompt: '¿Cómo hago bien la sentadilla?' },
];

const MAX_STORED = 40;

const LOADING_STEPS = [
  { after: 0, label: 'Analizando tus datos…' },
  { after: 6000, label: 'Armando tu respuesta…' },
  { after: 16000, label: 'El servidor gratuito está con carga, casi listo…' },
];

function TypingDots() {
  const [values] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  const [step, setStep] = useState(0);

  // Long waits should read as progress, not as a frozen screen.
  useEffect(() => {
    const timers = LOADING_STEPS.slice(1).map((item, index) => setTimeout(() => setStep(index + 1), item.after));
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View style={styles.typing} accessibilityLabel="El coach está escribiendo">
      {values.map((value, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: value }]} />
      ))}
      <AppText variant="caption" color="textMuted" style={styles.typingText}>
        {LOADING_STEPS[step].label}
      </AppText>
    </View>
  );
}

export function CoachScreen({ initialPrompt }: { initialPrompt?: string }) {
  const profile = useAppStore(selectProfile);
  const plan = useMemo(() => calculateNutritionPlan(profile), [profile]);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const dictation = useDictation(setInput);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const initialSent = useRef(false);

  // Restore the last conversation.
  useEffect(() => {
    let cancelled = false;
    Storage.loadCoachChat<CoachMessage>().then((stored) => {
      if (cancelled) return;
      setMessages(Array.isArray(stored) ? stored : []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (loaded) Storage.saveCoachChat(messages.slice(-MAX_STORED));
  }, [messages, loaded]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      FeedbackService.lightTap();

      const userMessage: CoachMessage = { id: createId('msg'), role: 'user', text, createdAt: Date.now() };
      // Drop out-of-scope exchanges (question + refusal) so the model does not copy the refusal pattern.
      const priorHistory = messages.filter((message, index) => message.source !== 'scope' && messages[index + 1]?.source !== 'scope');
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { history } = getAppState();
        const reply = await askCoach({ prompt: text, history: priorHistory, profile, workouts: history, signal: controller.signal });
        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'assistant',
            text: reply.text,
            blocks: reply.blocks,
            suggestions: reply.suggestions,
            source: reply.source,
            createdAt: Date.now(),
          },
        ]);
        FeedbackService.selection();
      } catch {
        if (!controller.signal.aborted) {
          setMessages((prev) => [
            ...prev,
            { id: createId('msg'), role: 'assistant', text: 'No pude responder ahora mismo. Inténtalo de nuevo.', createdAt: Date.now() },
          ]);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
      }
    },
    [loading, messages, profile]
  );

  useEffect(() => {
    if (loaded && initialPrompt && !initialSent.current) {
      initialSent.current = true;
      send(initialPrompt);
    }
  }, [loaded, initialPrompt, send]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const clear = () => {
    Alert.alert('Borrar conversación', 'Se borrarán todos los mensajes de este chat.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          abortRef.current?.abort();
          setMessages([]);
        },
      },
    ]);
  };

  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const lastSource = [...messages].reverse().find((message) => message.source)?.source;

  const renderMessage = ({ item }: { item: CoachMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userBubble}>
          <AppText variant="body" style={styles.userText}>
            {item.text}
          </AppText>
        </View>
      );
    }
    const showSuggestions = item.id === lastAssistantId && !loading && (item.suggestions?.length ?? 0) > 0;
    return (
      <View style={styles.assistant}>
        <View style={styles.assistantHeader}>
          <View style={styles.coachAvatar}>
            <Ionicons name="sparkles" size={12} color={theme.colors.onPrimary} />
          </View>
          <AppText variant="caption" color="textMuted" style={styles.bold}>
            Coach{item.source === 'offline' ? ' · respuesta básica' : ''}
          </AppText>
        </View>
        {!!item.text && <RichText text={item.text} />}
        {item.blocks?.map((block, index) => (
          <CoachBlockView key={`${item.id}_${index}`} block={block} plan={plan} />
        ))}
        {showSuggestions && (
          <View style={styles.suggestions}>
            {item.suggestions!.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => send(suggestion)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
              >
                <AppText variant="subhead" color="primary" style={styles.bold} numberOfLines={1}>
                  {suggestion}
                </AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const empty = loaded && messages.length === 0 && !loading;
  const canSend = input.trim().length > 0 && !loading;

  return (
    <StackScreen>
      <View style={styles.header}>
        <IconButton icon="chevron-down" variant="filled" size={38} onPress={() => router.back()} accessibilityLabel="Cerrar coach" />
        <View style={styles.headerCenter}>
          <AppText variant="headline">Coach IA</AppText>
          <View style={styles.status}>
            <View style={[styles.statusDot, lastSource === 'offline' && styles.statusOffline]} />
            <AppText variant="caption" color="textMuted">
              {lastSource === 'offline' ? 'Sin IA · respuestas básicas' : `IA gratis · ${COACH_MODEL_LABEL}`}
            </AppText>
          </View>
        </View>
        <IconButton icon="trash-outline" size={38} onPress={clear} disabled={messages.length === 0} accessibilityLabel="Borrar conversación" />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {empty ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles" size={28} color={theme.colors.primary} />
            </View>
            <AppText variant="title" align="center">
              ¿En qué te ayudo hoy?
            </AppText>
            <AppText variant="subhead" color="textMuted" align="center" style={styles.welcomeText}>
              Conozco tu perfil, tu equipo y tu historial. Te respondo con rutinas y ejercicios que puedes empezar al instante.
            </AppText>
            <View style={styles.starters}>
              {STARTERS.map((starter) => (
                <Pressable
                  key={starter.label}
                  accessibilityRole="button"
                  onPress={() => send(starter.prompt)}
                  style={({ pressed }) => [styles.starter, pressed && styles.suggestionPressed]}
                >
                  <Ionicons name={starter.icon} size={18} color={theme.colors.primary} />
                  <AppText variant="subhead" style={styles.starterText} numberOfLines={2}>
                    {starter.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            inverted
            data={reversed}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messages}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={loading ? <TypingDots /> : null}
            showsVerticalScrollIndicator={false}
          />
        )}

        {dictation.error && (
          <AppText variant="caption" color="textMuted" align="center" style={styles.dictationError}>
            {dictation.error}
          </AppText>
        )}
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={dictation.listening ? 'Escuchando…' : 'Pregunta o toca el micrófono para hablar'}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            selectionColor={theme.colors.primary}
            style={styles.input}
            accessibilityLabel="Mensaje para el coach"
          />
          {loading ? (
            <IconButton icon="stop" variant="filled" size={44} onPress={stop} accessibilityLabel="Detener respuesta" />
          ) : dictation.listening ? (
            <IconButton icon="mic" variant="primary" size={44} onPress={dictation.stop} accessibilityLabel="Dejar de escuchar" />
          ) : input.trim() ? (
            <IconButton icon="arrow-up" variant="primary" size={44} onPress={() => send(input)} disabled={!canSend} accessibilityLabel="Enviar" />
          ) : (
            <IconButton icon="mic-outline" variant="filled" size={44} onPress={() => dictation.start(input)} accessibilityLabel="Dictar mensaje" />
          )}
        </View>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  statusOffline: {
    backgroundColor: theme.colors.textMuted,
  },
  messages: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  userText: {
    color: theme.colors.onPrimary,
    fontWeight: '500',
  },
  assistant: {
    gap: theme.spacing.md,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: {
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  suggestion: {
    maxWidth: '100%',
    paddingHorizontal: theme.spacing.md,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    backgroundColor: theme.colors.primarySoft,
  },
  suggestionPressed: {
    opacity: 0.7,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: theme.spacing.sm,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  typingText: {
    marginLeft: theme.spacing.sm,
  },
  welcome: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  welcomeText: {
    maxWidth: 320,
  },
  starters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    alignSelf: 'stretch',
  },
  starter: {
    flexGrow: 1,
    flexBasis: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  starterText: {
    flex: 1,
    fontWeight: '600',
  },
  dictationError: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    fontSize: 15,
  },
});
