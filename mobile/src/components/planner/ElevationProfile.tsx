import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { ProfilePoint } from '@/api/routes';
import { colors } from '@/constants/theme';
import { formatKilometres, roundMeters } from '@/planner/format';
import {
  distanceAtX,
  downsampleProfile,
  nearestProfileIndex,
  profileChart,
} from '@/planner/profile';

const CHART_HEIGHT = 96;
const CHART_PADDING = 6;
/** More points than pixels would only cost drawing time */
const MAX_DRAWN_POINTS = 300;
/** Screen reader steps along the route */
const ACCESSIBLE_STEPS = 20;

type Props = {
  profile: ProfilePoint[];
  /** Selected distance along the route, or null */
  selected: number | null;
  onSelect: (distanceMeters: number) => void;
};

/**
 * Elevation profile drawn with react-native-svg. Touching or dragging along it selects the
 * matching distance; screen reader users swipe up or down (adjustable) to move along it.
 */
export function ElevationProfile({ profile, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const drawn = downsampleProfile(profile, MAX_DRAWN_POINTS);
  const chart = profileChart(drawn, { width, height: CHART_HEIGHT, padding: CHART_PADDING });
  if (profile.length < 2) return null;

  const start = profile[0][0];
  const end = profile[profile.length - 1][0];
  const selectedIndex = selected === null ? -1 : nearestProfileIndex(profile, selected);
  const selectedPoint = selectedIndex >= 0 ? profile[selectedIndex] : null;
  const selectedX =
    selectedPoint && chart ? ((selectedPoint[0] - start) / chart.totalDistance) * width : null;

  const select = (event: GestureResponderEvent) =>
    onSelect(distanceAtX(profile, event.nativeEvent.locationX, width));

  const step = (direction: 1 | -1) => {
    const stepSize = (end - start) / ACCESSIBLE_STEPS;
    const current = selectedPoint?.[0] ?? (direction === 1 ? start - stepSize : end + stepSize);
    onSelect(Math.min(end, Math.max(start, current + direction * stepSize)));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') step(1);
    if (event.nativeEvent.actionName === 'decrement') step(-1);
  };

  const minElevation = roundMeters(chart?.minElevation ?? 0);
  const maxElevation = roundMeters(chart?.maxElevation ?? 0);
  const positionText = selectedPoint
    ? t('planner.profile.position', {
        km: formatKilometres(selectedPoint[0]),
        meters: roundMeters(selectedPoint[1]),
      })
    : undefined;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('planner.profile.heading')}
      </Text>
      <View
        style={styles.chart}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('planner.profile.label', { min: minElevation, max: maxElevation })}
        accessibilityValue={positionText ? { text: positionText } : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Keep the gesture while dragging along the chart instead of scrolling the panel
        onResponderTerminationRequest={() => false}
        onResponderGrant={select}
        onResponderMove={select}
      >
        {chart ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Path d={chart.area} fill={colors.accent} fillOpacity={0.25} />
            <Path d={chart.line} stroke={colors.accent} strokeWidth={2} fill="none" />
            {selectedX !== null ? (
              <Line
                x1={selectedX}
                x2={selectedX}
                y1={0}
                y2={CHART_HEIGHT}
                stroke={colors.text}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.legend}>
        <Text style={styles.muted}>
          {t('planner.profile.range', { min: minElevation, max: maxElevation })}
        </Text>
        <Text style={styles.value} accessibilityLiveRegion="polite">
          {positionText ?? t('planner.profile.touchHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chart: {
    height: CHART_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  value: {
    color: colors.text,
    fontSize: 13,
  },
});
