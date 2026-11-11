import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { ROUTE_NAME_MAX_LENGTH, ROUTE_NOTE_MAX_LENGTH, validateRouteDetails } from '@/api/routes';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { TextField } from '@/components/TextField';

type Props = {
  initialName: string;
  initialNote: string;
  /** Saves the trimmed values; throws on failure */
  onSubmit: (name: string, note: string) => Promise<void>;
  /** Shown instead of the form error, e.g. when there is nothing to save yet */
  blocker?: string;
};

/** Name (1 to 80 characters, required) and note (up to 1,000) of a saved route. */
export function RouteDetailsForm({ initialName, initialNote, onSubmit, blocker }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote);
  const [errors, setErrors] = useState<ReturnType<typeof validateRouteDetails>>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const invalid = validateRouteDetails(name, note);
    setErrors(invalid);
    setFormError(undefined);
    if (invalid || blocker) return;
    setBusy(true);
    try {
      await onSubmit(name.trim(), note.trim());
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(false);
    }
  };

  const nameError =
    errors?.name === 'required'
      ? t('routeDetails.nameRequired')
      : errors?.name === 'tooLong'
        ? t('routeDetails.nameTooLong')
        : undefined;

  return (
    <>
      <TextField
        label={t('routeDetails.nameLabel')}
        hint={t('routeDetails.nameHint')}
        error={nameError}
        value={name}
        onChangeText={setName}
        // A little room over the limit so pasted text is not silently cut; validation explains
        maxLength={ROUTE_NAME_MAX_LENGTH + 20}
        returnKeyType="next"
        editable={!busy}
      />
      <TextField
        label={t('routeDetails.noteLabel')}
        hint={t('routeDetails.noteHint')}
        error={errors?.note ? t('routeDetails.noteTooLong') : undefined}
        value={note}
        onChangeText={setNote}
        maxLength={ROUTE_NOTE_MAX_LENGTH + 100}
        multiline
        editable={!busy}
      />
      <FormMessage message={blocker ?? formError} />
      <Button label={t('routeDetails.save')} onPress={submit} busy={busy} disabled={!!blocker} />
    </>
  );
}
