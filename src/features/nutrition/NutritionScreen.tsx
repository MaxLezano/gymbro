import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { GOAL_LABELS } from '../../core/i18n/labels';
import { calculateNutritionPlan } from '../../core/utils/nutrition';
import { selectProfile, useAppStore } from '../../state/appStore';
import { AppText, Badge, Button, Card, ScreenHeader, SectionHeader, StatTile } from '../../components/ui';
import { TabScreen } from '../../components/layout/TabScreen';
import { HeaderActions } from '../../components/layout/HeaderActions';
import { MacroSummary } from './MacroSummary';

/** Horizontal scale with a marker, used for FFMI and the healthy weight range. */
function ScaleBar({
  min,
  max,
  value,
  bands,
  markerLabel,
}: {
  min: number;
  max: number;
  value: number;
  bands: { from: number; to: number; color: string }[];
  markerLabel: string;
}) {
  const position = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%` as const;
  return (
    <View style={styles.scale} accessibilityLabel={markerLabel}>
      <View style={styles.scaleTrack}>
        {bands.map((band, index) => (
          <View
            key={index}
            style={[
              styles.scaleBand,
              { left: position(band.from), width: `${((band.to - band.from) / (max - min)) * 100}%`, backgroundColor: band.color },
            ]}
          />
        ))}
      </View>
      <View style={[styles.marker, { left: position(value) }]} />
      <View style={styles.scaleLabels}>
        <AppText variant="caption" color="textMuted">
          {min}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {max}
        </AppText>
      </View>
    </View>
  );
}

export function NutritionScreen() {
  const profile = useAppStore(selectProfile);
  const plan = useMemo(() => calculateNutritionPlan(profile), [profile]);
  const goal = GOAL_LABELS[profile.fitnessGoal];
  const meals = 4;
  const weightDelta = Math.round((plan.idealWeightKg - profile.weightKg) * 10) / 10;
  const ffmiBands =
    profile.gender === 'male'
      ? [
          { from: 16, to: 18, color: theme.colors.surfacePressed },
          { from: 18, to: 22, color: 'rgba(255, 159, 10, 0.35)' },
          { from: 22, to: 25, color: 'rgba(50, 215, 75, 0.45)' },
          { from: 25, to: 27, color: 'rgba(100, 210, 255, 0.4)' },
        ]
      : [
          { from: 13, to: 15, color: theme.colors.surfacePressed },
          { from: 15, to: 19, color: 'rgba(255, 159, 10, 0.35)' },
          { from: 19, to: 21, color: 'rgba(50, 215, 75, 0.45)' },
          { from: 21, to: 23, color: 'rgba(100, 210, 255, 0.4)' },
        ];
  const ffmiRange = profile.gender === 'male' ? { min: 16, max: 27 } : { min: 13, max: 23 };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Nutrición" subtitle="Calculado con tu biometría, 100 % offline" right={<HeaderActions />} />

        <View style={styles.body}>
          <Card>
            <View style={styles.heroTop}>
              <View style={styles.flex}>
                <AppText variant="caption" color="textMuted">
                  Meta diaria
                </AppText>
                <View style={styles.kcalRow}>
                  <AppText style={styles.kcal}>{plan.targetCalories.toLocaleString('es-ES')}</AppText>
                  <AppText variant="headline" color="textMuted">
                    kcal
                  </AppText>
                </View>
                <Badge label={`${goal.title} · ${goal.short}`} tone="accent" icon="flag-outline" />
              </View>
              <Button label="Ajustar" icon="options-outline" variant="secondary" size="sm" onPress={() => router.push('/profile')} />
            </View>
            <View style={styles.divider} />
            <MacroSummary plan={plan} />
          </Card>

          <View style={styles.row}>
            <StatTile label="Agua" value={plan.waterLitersDaily} unit="L" icon="water-outline" iconColor={theme.colors.info} />
            <StatTile label="Por comida" value={Math.round(plan.proteinGrams / meals)} unit="g prot." icon="restaurant-outline" caption={`${meals} comidas/día`} />
          </View>

          <Button
            label="¿Qué como hoy? Pregúntale al coach"
            icon="sparkles"
            variant="tonal"
            size="lg"
            fullWidth
            onPress={() => router.push({ pathname: '/coach', params: { prompt: 'Armame un menú de un día que cumpla mis macros' } })}
          />

          <Card>
            <SectionHeader title="Composición corporal" />
            <View style={styles.row}>
              <StatTile label="Grasa corporal" value={plan.bodyFatPercent} unit="%" style={styles.innerTile} />
              <StatTile label="Masa magra" value={plan.leanMassKg} unit="kg" style={styles.innerTile} />
              <StatTile label="Masa grasa" value={plan.fatMassKg} unit="kg" style={styles.innerTile} />
            </View>
            <View style={styles.method}>
              <Ionicons
                name={plan.bodyFatMethod === 'navy' ? 'checkmark-circle' : 'information-circle-outline'}
                size={16}
                color={plan.bodyFatMethod === 'navy' ? theme.colors.success : theme.colors.textMuted}
              />
              <AppText variant="caption" color="textSecondary" style={styles.flex}>
                {plan.bodyFatMethod === 'navy'
                  ? 'Método U.S. Navy con tus medidas de cinta (error típico ±3 %).'
                  : 'Estimación por IMC (Deurenberg). Añade cuello y cintura para más precisión.'}
              </AppText>
            </View>
            {plan.bodyFatMethod !== 'navy' && (
              <Button label="Añadir medidas" icon="add" variant="secondary" size="sm" onPress={() => router.push('/profile')} style={styles.methodButton} />
            )}
          </Card>

          <Card>
            <SectionHeader title="Nivel muscular" />
            <View style={styles.ffmiTop}>
              <AppText style={styles.ffmiValue}>{plan.ffmi}</AppText>
              <View style={styles.flex}>
                <AppText variant="callout" style={styles.bold}>
                  {plan.ffmiCategory}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  FFMI normalizado a 1,80 m (Kouri et al., 1995)
                </AppText>
              </View>
            </View>
            <ScaleBar {...ffmiRange} value={plan.ffmi} bands={ffmiBands} markerLabel={`FFMI ${plan.ffmi}, ${plan.ffmiCategory}`} />
          </Card>

          <Card>
            <SectionHeader title="Peso" />
            <View style={styles.row}>
              <StatTile label="Actual" value={profile.weightKg} unit="kg" caption={`IMC ${plan.bmi} · ${plan.bmiCategory}`} style={styles.innerTile} />
              <StatTile
                label="Meta atlética"
                value={plan.idealWeightKg}
                unit="kg"
                caption={weightDelta === 0 ? 'Estás en tu meta' : `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`}
                style={styles.innerTile}
                iconColor={theme.colors.primary}
                icon="flag-outline"
              />
            </View>
            <AppText variant="caption" color="textMuted" style={styles.rangeLabel}>
              Rango saludable OMS para {profile.heightCm} cm: {plan.healthyWeightRange.min}–{plan.healthyWeightRange.max} kg
            </AppText>
            <ScaleBar
              min={Math.floor(plan.healthyWeightRange.min - 15)}
              max={Math.ceil(plan.healthyWeightRange.max + 15)}
              value={profile.weightKg}
              bands={[{ from: plan.healthyWeightRange.min, to: plan.healthyWeightRange.max, color: 'rgba(50, 215, 75, 0.45)' }]}
              markerLabel={`Peso actual ${profile.weightKg} kilos`}
            />
          </Card>

          <Card>
            <SectionHeader title="Gasto energético" />
            <View style={styles.energyRow}>
              <EnergyItem label="Basal (BMR)" value={plan.bmr} />
              <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
              <EnergyItem label="Total (TDEE)" value={plan.tdee} />
              <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
              <EnergyItem label="Meta" value={plan.targetCalories} highlight />
            </View>
            <AppText variant="caption" color="textMuted" style={styles.formula}>
              Mifflin-St Jeor · {profile.weightKg} kg, {profile.heightCm} cm, {profile.age} años
            </AppText>
          </Card>
        </View>
      </ScrollView>
    </TabScreen>
  );
}

function EnergyItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.energyItem}>
      <AppText variant="headline" color={highlight ? 'primary' : 'text'} style={styles.tabular}>
        {value.toLocaleString('es-ES')}
      </AppText>
      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing.xxxl,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  kcal: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  innerTile: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: theme.spacing.md,
  },
  methodButton: {
    marginTop: theme.spacing.md,
  },
  ffmiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  ffmiValue: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  scale: {
    paddingTop: 6,
  },
  scaleTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfacePressed,
    overflow: 'hidden',
  },
  scaleBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: 4,
    height: 20,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rangeLabel: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  energyItem: {
    flex: 1,
    alignItems: 'center',
  },
  formula: {
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  bold: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
});
