import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';

type Props = {
  mode: 'date' | 'time';
  /** Visible label and screen-reader name. Pass a translated string. */
  label: string;
  /** Formatted value, or null when not set */
  displayValue: string | null;
  /** Value the picker opens with (wall-clock fields only) */
  pickerValue: Date;
  onChange: (value: Date) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * A date or time field that opens the system picker: a dialog on Android, an inline picker on
 * iOS. The chosen wall-clock value is used as is (see `rides/dateTime.ts`).
 */
export function DateTimeField({
  mode,
  label,
  displayValue,
  pickerValue,
  onChange,
  error,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const shown = displayValue ?? t('rides.form.notSet');

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode,
        is24Hour: true,
        onValueChange: (_event, date) => onChange(date),
      });
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('rides.form.pickerLabel', { field: label, value: shown })}
        accessibilityHint={error ?? t('rides.form.pickerHint')}
        accessibilityState={{ disabled, expanded: Platform.OS === 'ios' ? open : undefined }}
        onPress={press}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          { borderColor: error ? colors.danger : colors.textMuted },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={displayValue ? styles.value : styles.placeholder}>{shown}</Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {Platform.OS === 'ios' && open ? (
        <View style={styles.inline}>
          <DateTimePicker
            value={pickerValue}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            themeVariant="dark"
            accentColor={colors.accent}
            textColor={colors.text}
            onValueChange={(_event, date) => onChange(date)}
          />
          <Button
            variant="secondary"
            label={t('rides.form.pickerDone')}
            onPress={() => setOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    alignSelf: 'stretch',
  },
  field: {
    minHeight: MIN_TOUCH_TARGET + 4,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  value: {
    color: colors.text,
    fontSize: 17,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 17,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  inline: {
    gap: 8,
  },
});
