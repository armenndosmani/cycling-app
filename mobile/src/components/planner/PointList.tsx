import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors } from '@/constants/theme';
import type { ListedPoint } from '@/planner/points';

type Props = {
  points: ListedPoint[];
  waypointCount: number;
  pointLabel: (point: ListedPoint) => string;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
};

/**
 * The route's points in order, with buttons to reorder stops and remove any point. Also the
 * screen-reader way to edit points, since map markers are hard to reach without sight.
 */
export function PointList({ points, waypointCount, pointLabel, onRemove, onReorder }: Props) {
  const { t } = useTranslation();
  if (points.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('planner.points.heading')}
      </Text>
      {points.map((listed) => {
        const label = pointLabel(listed);
        const isWaypoint = listed.role === 'waypoint';
        return (
          <View key={listed.point.id} style={styles.row}>
            <View style={styles.text} accessible>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.muted} numberOfLines={2}>
                {listed.point.name ?? t('planner.points.onMap')}
              </Text>
            </View>
            {isWaypoint ? (
              <>
                <Button
                  variant="link"
                  label={t('planner.points.moveUp')}
                  accessibilityLabel={t('planner.points.moveUpLabel', { point: label })}
                  onPress={() => onReorder(listed.point.id, -1)}
                  disabled={listed.index === 0}
                />
                <Button
                  variant="link"
                  label={t('planner.points.moveDown')}
                  accessibilityLabel={t('planner.points.moveDownLabel', { point: label })}
                  onPress={() => onReorder(listed.point.id, 1)}
                  disabled={listed.index === waypointCount - 1}
                />
              </>
            ) : null}
            <Button
              variant="link"
              label={t('planner.points.remove')}
              accessibilityLabel={t('planner.points.removeLabel', { point: label })}
              onPress={() => onRemove(listed.point.id)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  text: {
    flexGrow: 1,
    flexBasis: 140,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
