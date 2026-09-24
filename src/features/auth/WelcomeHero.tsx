import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../core/theme';
import { WELCOME_IMAGES } from '../../data/covers';
import { AppText } from '../../components/ui';

const BRAND_MARK = require('../../../assets/brand-mark.png');
const AUTOPLAY_MS = 5000;
/** Slightly longer than the native paging animation. */
const WRAP_DELAY_MS = 450;
const SLIDE_COUNT = WELCOME_IMAGES.length;
/** Slide 0 repeated at the end so the loop always moves forward. */
const LOOPED_IMAGES = [...WELCOME_IMAGES, WELCOME_IMAGES[0]];

const SLIDES = [
  { title: 'Entrena con un plan hecho para ti', text: 'Rutinas según tu objetivo, tu nivel y el equipo que tienes.' },
  { title: 'Mide cada repetición', text: 'Récords, volumen y 1RM automáticos para progresar cada semana.' },
  { title: 'Tu coach, siempre contigo', text: 'Un coach con IA gratis que arma tus rutinas y te guía con la comida.' },
];

/**
 * Full-bleed photo carousel with brand and per-slide copy (Hevy-style welcome).
 * `children` render in the bottom panel, over the dark gradient.
 */
export function WelcomeHero({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const listRef = useRef<FlatList>(null);
  const [scrollX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Seamless wrap: when the clone of slide 0 (last item) is reached, jump back
  // to the real slide 0 without animation. They are identical, so it's invisible.
  const wrapIfOnClone = (position: number) => {
    if (position === SLIDE_COUNT) {
      listRef.current?.scrollToIndex({ index: 0, animated: false });
      setIndex(0);
    }
  };

  // Auto-advance; restarts after every slide change (manual or automatic) and
  // pauses while the athlete is swiping. Disabled with "reduce motion".
  useEffect(() => {
    if (dragging || reduceMotion) return;
    const timer = setTimeout(() => {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
      if (next === SLIDE_COUNT) setTimeout(() => wrapIfOnClone(next), WRAP_DELAY_MS);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, dragging, reduceMotion]);

  const positionOf = (event: NativeSyntheticEvent<NativeScrollEvent>) => Math.round(event.nativeEvent.contentOffset.x / width);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = positionOf(event);
      if (dragging && next !== index) setIndex(next);
    },
  });

  // Each dot follows the scroll offset, so it stretches and fills in step with
  // the photo instead of snapping. The clone (last position) maps to dot 0.
  const positions = LOOPED_IMAGES.map((_, i) => i * width);
  const dotStyle = (dot: number) => {
    const active = (position: number) => position % SLIDE_COUNT === dot;
    return {
      width: scrollX.interpolate({
        inputRange: positions,
        outputRange: positions.map((_, p) => (active(p) ? 22 : 7)),
        extrapolate: 'clamp' as const,
      }),
      backgroundColor: scrollX.interpolate({
        inputRange: positions,
        outputRange: positions.map((_, p) => (active(p) ? theme.colors.primary : 'rgba(255,255,255,0.35)')),
        extrapolate: 'clamp' as const,
      }),
    };
  };

  const slide = SLIDES[index % SLIDE_COUNT];
  const dotIndex = index % SLIDE_COUNT;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef}
        data={LOOPED_IMAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={(event) => {
          const position = positionOf(event);
          setIndex(position);
          wrapIfOnClone(position);
          setDragging(false);
        }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        scrollEventThrottle={32}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Image source={item} style={{ width, height }} contentFit="cover" accessibilityIgnoresInvertColors />}
      />
      <LinearGradient
        colors={['rgba(10,10,11,0.55)', 'rgba(10,10,11,0)', 'rgba(10,10,11,0.88)', theme.colors.background]}
        locations={[0, 0.2, 0.48, 0.66]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.brand, { top: insets.top + theme.spacing.lg }]} pointerEvents="none">
        <Image source={BRAND_MARK} style={styles.brandMark} contentFit="contain" accessibilityLabel="GymBro" />
        <AppText variant="title" style={styles.brandName}>
          GymBro
        </AppText>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + theme.spacing.lg }]} pointerEvents="box-none">
        <AppText variant="largeTitle" align="center" style={styles.onImage}>
          {slide.title}
        </AppText>
        <AppText variant="body" align="center" style={styles.text}>
          {slide.text}
        </AppText>
        <View style={styles.dots} accessibilityLabel={`Página ${dotIndex + 1} de ${SLIDE_COUNT}`}>
          {SLIDES.map((_, i) => (
            <Animated.View key={i} style={[styles.dot, dotStyle(i)]} />
          ))}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  brand: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
  },
  brandName: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  onImage: {
    color: '#FFFFFF',
  },
  text: {
    color: 'rgba(255,255,255,0.82)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: theme.spacing.xs,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
