import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';
import { MAP_ATTRIBUTION } from '@/map/mapStyle';

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Visible OpenStreetMap licence notice in the map's lower left corner; opens the copyright page. */
export function MapAttribution() {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={t('planner.attributionHint')}
      onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
      style={styles.attribution}
      hitSlop={14}
    >
      <Text style={styles.attributionText}>{MAP_ATTRIBUTION}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  attribution: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.background,
    borderTopRightRadius: 6,
  },
  attributionText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
