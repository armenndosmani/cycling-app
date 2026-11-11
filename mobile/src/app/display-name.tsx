import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import {
  BICYCLE_TYPES,
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
  updateMe,
  type BicycleType,
} from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/theme';

/** Shown after the first sign-in, until the rider has a display name. */
export default function DisplayNameScreen() {
  const { t } = useTranslation();
  const { me, setMe, signOut } = useAuth();
  const [name, setName] = useState('');
  const [bikes, setBikes] = useState<BicycleType[]>(me?.bicycleTypes ?? []);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const toggleBike = (type: BicycleType, checked: boolean) =>
    // Keep the order the rider ticked them in: the first one is the route planner default
    setBikes((current) => (checked ? [...current, type] : current.filter((b) => b !== type)));

  const submit = async () => {
    setFormError(undefined);
    if (!isValidDisplayName(name)) {
      setFieldError(t('profile.setup.nameInvalid'));
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      // On success the protected routes switch to the app
      setMe(await updateMe({ displayName: name.trim(), bicycleTypes: bikes }));
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen heading={t('profile.setup.heading')} intro={t('profile.setup.intro')} withTopInset>
      <TextField
        label={t('profile.setup.nameLabel')}
        hint={t('profile.setup.nameHint')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setFieldError(undefined);
        }}
        error={fieldError}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="nickname"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        returnKeyType="done"
        editable={!busy}
      />

      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupHeading}>
          {t('profile.setup.bikesHeading')}
        </Text>
        {BICYCLE_TYPES.map((type) => (
          <Checkbox
            key={type}
            label={t(`profile.bicycleTypes.${type}`)}
            checked={bikes.includes(type)}
            onChange={(checked) => toggleBike(type, checked)}
            disabled={busy}
          />
        ))}
      </View>

      <FormMessage message={formError} />
      <Button label={t('profile.setup.submit')} onPress={submit} busy={busy} />
      <Button variant="secondary" label={t('home.signOut')} onPress={signOut} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 4,
  },
  groupHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
});
