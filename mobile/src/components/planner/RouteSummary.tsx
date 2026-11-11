import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import { routeFailure, type CalculatedRoute, type SurfaceShare } from '@/api/routes';
import { Button } from '@/components/Button';
import { colors } from '@/constants/theme';
import { formatKilometres, roundMeters } from '@/planner/format';
import { surfacePercentages } from '@/planner/surfaces';
import type { CalculationStatus } from '@/planner/usePlanner';

type Props = {
  status: CalculationStatus;
  route: CalculatedRoute | null;
  onRetry: () => void;
};

/** Calculation state, distance, elevation gain and surface breakdown. */
export function RouteSummary({ status, route, onRetry }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Live region: screen readers hear when calculating starts, ends or fails */}
      <View accessibilityLiveRegion="polite" style={styles.status}>
        {status.kind === 'loading' ? (
          <View style={styles.loading} accessible accessibilityRole="progressbar">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>{t('planner.status.calculating')}</Text>
          </View>
        ) : null}
        {status.kind === 'error' ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {failureText(status.error)}
            </Text>
            <Button variant="secondary" label={t('planner.status.retry')} onPress={onRetry} />
          </>
        ) : null}
      </View>

      {route ? (
        <View style={styles.stats}>
          <View
            style={styles.stat}
            accessible
            accessibilityLabel={t('planner.stats.distanceLabel', {
              km: formatKilometres(route.distanceMeters),
            })}
          >
            <Text style={styles.muted}>{t('planner.stats.distance')}</Text>
            <Text style={styles.value}>
              {t('planner.stats.distanceValue', { km: formatKilometres(route.distanceMeters) })}
            </Text>
          </View>
          <View
            style={styles.stat}
            accessible
            accessibilityLabel={
              route.ascendMeters === null
                ? t('planner.stats.elevationUnavailable')
                : t('planner.stats.ascendLabel', { meters: roundMeters(route.ascendMeters) })
            }
          >
            <Text style={styles.muted}>{t('planner.stats.ascend')}</Text>
            <Text style={route.ascendMeters === null ? styles.unavailable : styles.value}>
              {route.ascendMeters === null
                ? t('planner.stats.elevationUnavailable')
                : t('planner.stats.ascendValue', { meters: roundMeters(route.ascendMeters) })}
            </Text>
          </View>
        </View>
      ) : null}

      {route ? <Surfaces surfaces={route.surfaces} /> : null}
    </View>
  );

  function failureText(error: unknown): string {
    const failure = routeFailure(error);
    if (failure === 'notFound') return t('planner.status.notFound');
    if (failure === 'unavailable') return t('planner.status.unavailable');
    return errorMessage(error);
  }
}

/** Surface breakdown in whole percentages; nothing when the route has no surface data. */
export function Surfaces({ surfaces }: { surfaces: SurfaceShare[] }) {
  const { t } = useTranslation();
  const shares = surfacePercentages(surfaces);
  if (shares.length === 0) return null;

  return (
    <View style={styles.surfaces}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('planner.surfaces.heading')}
      </Text>
      {shares.map(({ surface, percent }) => (
        <View key={surface} style={styles.surfaceRow} accessible>
          <Text style={styles.surfaceName}>
            {t('planner.surfaces.item', { surface: t(`planner.surfaces.${surface}`), percent })}
          </Text>
          {/* Decorative bar; the text above carries the value */}
          <View
            style={styles.barTrack}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <View style={[styles.bar, { width: `${percent}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  status: {
    gap: 8,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  stat: {
    gap: 2,
  },
  heading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  unavailable: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
  },
  surfaces: {
    gap: 6,
  },
  surfaceRow: {
    gap: 4,
  },
  surfaceName: {
    color: colors.text,
    fontSize: 14,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    backgroundColor: colors.accent,
  },
});
