import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISCIPLINES, type Discipline } from '@/api/routes';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';

type Props = {
  value: Discipline;
  onChange: (discipline: Discipline) => void;
};

/** One choice per route: road, gravel, MTB or urban. Announced as a radio group. */
export function DisciplinePicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('planner.discipline.label')}
    >
      {DISCIPLINES.map((discipline) => {
        const selected = discipline === value;
        return (
          <Pressable
            key={discipline}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(discipline)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            {/* The tick shows the choice without relying on colour */}
            <Text style={[styles.text, selected && styles.selectedText]}>
              {selected ? '✓ ' : ''}
              {t(`profile.bicycleTypes.${discipline}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedText: {
    color: colors.onAccent,
  },
});
