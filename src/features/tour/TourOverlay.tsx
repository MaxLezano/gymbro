import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';
import { theme } from '../../core/theme';
import { AppText, Button, ProgressBar } from '../../components/ui';
import { TOUR_STEPS } from './steps';
import { measureTarget, Tour, useTour, type Rect } from './tour';

const HOLE_PAD = 6;
const GAP = 14;
const SIDE = 16;
const ARROW = 14;
/** Tabs mount and settle before their targets are measured. */
const SETTLE_MS = 450;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function roundedRect({ x, y, width: w, height: h }: Rect, r: number) {
  return (
    `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  );
}

/** Pads the target and keeps it on screen (tall cards may run under the tab bar). */
function holeFor(rect: Rect, width: number, height: number): Rect | null {
  const top = Math.max(HOLE_PAD, rect.y - HOLE_PAD);
  const bottom = Math.min(height - HOLE_PAD, rect.y + rect.height + HOLE_PAD);
  const left = Math.max(HOLE_PAD, rect.x - HOLE_PAD);
  const right = Math.min(width - HOLE_PAD, rect.x + rect.width + HOLE_PAD);
  if (bottom - top < 24 || right - left < 24) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Coach-mark walkthrough drawn over the whole app: dims everything except the
 * current target and explains it in a bubble with back / next buttons.
 */
export function TourOverlay() {
  const { active, index } = useTour();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [shown, setShown] = useState<{ index: number; rect: Rect | null } | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const [fade] = useState(() => new Animated.Value(0));
  const step = TOUR_STEPS[index];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fade.setValue(0);
    (async () => {
      if (step.route) router.navigate(step.route);
      await wait(SETTLE_MS);
      const target = step.target ? await measureTarget(step.target) : null;
      // The overlay may not start at the window origin: compare both in window coordinates.
      const origin = await new Promise<{ x: number; y: number }>((resolve) =>
        rootRef.current ? rootRef.current.measureInWindow((x, y) => resolve({ x, y })) : resolve({ x: 0, y: 0 })
      );
      if (cancelled) return;
      if (step.target && !target) {
        Tour.skipMissing();
        return;
      }
      setShown({ index, rect: target && { ...target, x: target.x - origin.x, y: target.y - origin.y } });
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    })();
    return () => {
      cancelled = true;
    };
  }, [active, index, step, fade]);

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) Tour.finish();
      else Tour.prev();
      return true;
    });
    return () => sub.remove();
  }, [active, index]);

  if (!active) return null;

  const { width, height } = size;
  const ready = shown?.index === index;
  const hole = ready && shown.rect ? holeFor(shown.rect, width, height) : null;
  // Small targets (round header buttons) get a round spotlight; cards get soft corners.
  const radius = hole ? (Math.max(hole.width, hole.height) < 90 ? Math.min(hole.width, hole.height) / 2 : 16) : 0;
  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;

  // Below the target when it fits, otherwise above it; centered when there is no target.
  const bubbleWidth = Math.min(width - SIDE * 2, 420);
  const bubbleLeft = (width - bubbleWidth) / 2;
  let bubbleTop = (height - bubbleHeight) / 2;
  let arrowTop: number | null = null;
  if (hole) {
    const below = hole.y + hole.height + GAP;
    if (below + bubbleHeight <= height - insets.bottom - SIDE) {
      bubbleTop = below;
      arrowTop = -ARROW / 2;
    } else {
      bubbleTop = Math.max(insets.top + SIDE, hole.y - GAP - bubbleHeight);
      arrowTop = bubbleHeight - ARROW / 2;
    }
  }
  const arrowLeft = hole
    ? Math.min(Math.max(hole.x + hole.width / 2 - bubbleLeft - ARROW / 2, 20), bubbleWidth - 20 - ARROW)
    : 0;

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      // Swallows every touch: the app underneath stays still while the tour runs.
      onStartShouldSetResponder={() => true}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={`M0,0H${width}V${height}H0Z${hole ? roundedRect(hole, radius) : ''}`}
            fill="rgba(0, 0, 0, 0.78)"
            fillRule="evenodd"
          />
          {hole && (
            <SvgRect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={radius}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2}
            />
          )}
        </Svg>
      )}

      <Animated.View
        accessibilityViewIsModal
        onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
        style={[styles.bubble, { width: bubbleWidth, left: bubbleLeft, top: bubbleTop, opacity: ready ? fade : 0 }]}
      >
        {arrowTop !== null && <View style={[styles.arrow, { top: arrowTop, left: arrowLeft }]} />}

        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name={step.icon} size={18} color={theme.colors.primary} />
          </View>
          <AppText variant="overline" color="textMuted" style={styles.flex}>
            {isFirst ? 'Tutorial' : `Paso ${index} de ${TOUR_STEPS.length - 1}`}
          </AppText>
          {!isFirst && !isLast && (
            <Button label="Saltar" variant="ghost" size="sm" onPress={Tour.finish} />
          )}
        </View>

        <AppText variant="headline" accessibilityRole="header">
          {step.title}
        </AppText>
        <AppText variant="callout" color="textSecondary">
          {step.body}
        </AppText>

        {!isFirst && <ProgressBar value={index / (TOUR_STEPS.length - 1)} height={3} />}

        <View style={styles.actions}>
          {isFirst ? (
            <Button label="Ahora no" variant="ghost" size="sm" onPress={Tour.finish} />
          ) : (
            <Button label="Atrás" variant="secondary" size="sm" icon="chevron-back" onPress={Tour.prev} />
          )}
          <Button
            label={isFirst ? 'Empezar' : isLast ? '¡A entrenar!' : 'Siguiente'}
            size="sm"
            iconRight={isLast ? 'checkmark' : 'chevron-forward'}
            onPress={Tour.next}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.raised,
  },
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    backgroundColor: theme.colors.surfaceAlt,
    transform: [{ rotate: '45deg' }],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 36,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
});
