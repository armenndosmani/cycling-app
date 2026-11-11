import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/ApiError';
import { errorMessage } from '@/api/errorMessage';
import {
  PLACE_QUERY_MAX_LENGTH,
  PLACE_QUERY_MIN_LENGTH,
  type LatLon,
  type Place,
} from '@/api/routes';
import { routesClient } from '@/api/routesClient';
import { TextField } from '@/components/TextField';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';
import { LatestRequest } from '@/planner/latestRequest';

const SEARCH_DELAY_MS = 350;

type Props = {
  /** Results near this point come first (the map centre, never the rider's GPS position) */
  near: LatLon | null;
  onSelect: (place: Place) => void;
  /** Screen-reader hint of a result; defaults to adding it to the route */
  resultHint?: string;
};

type Outcome = { query: string; places: Place[] } | { query: string; error: unknown };

/** Place search through our own backend (self-hosted Photon). Search terms are never logged. */
export function PlaceSearch({ near, onSelect, resultHint }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [latest] = useState(() => new LatestRequest());
  const query = text.trim();
  const searchable = [...query].length >= PLACE_QUERY_MIN_LENGTH;

  useEffect(() => {
    if (!searchable) return;
    const timer = setTimeout(() => {
      latest
        .run((signal) => routesClient.searchPlaces(query, near ?? undefined, signal))
        .then((result) => {
          if (!result.stale) setOutcome({ query, places: result.value });
        })
        .catch((error: unknown) => setOutcome({ query, error }));
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      latest.cancel();
    };
    // `near` is read when the search starts; moving the map alone does not search again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchable, latest]);

  const current = searchable && outcome?.query === query ? outcome : null;
  const searching = searchable && !current;

  const select = (place: Place) => {
    setText('');
    setOutcome(null);
    onSelect(place);
  };

  return (
    <View style={styles.container}>
      <TextField
        label={t('planner.search.label')}
        placeholder={t('planner.search.placeholder')}
        hint={searchable ? undefined : t('planner.search.hint')}
        value={text}
        onChangeText={setText}
        maxLength={PLACE_QUERY_MAX_LENGTH}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View accessibilityLiveRegion="polite">
        {searching ? (
          <View style={styles.searching} accessible accessibilityRole="progressbar">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>{t('planner.search.searching')}</Text>
          </View>
        ) : null}
        {current && 'error' in current ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {isUnavailable(current.error)
              ? t('planner.search.unavailable')
              : errorMessage(current.error)}
          </Text>
        ) : null}
        {current && 'places' in current && current.places.length === 0 ? (
          <Text style={styles.muted}>{t('planner.search.noResults')}</Text>
        ) : null}
      </View>
      {current && 'places' in current
        ? current.places.map((place, index) => (
            <Pressable
              key={`${index}-${place.lat}-${place.lon}`}
              accessibilityRole="button"
              accessibilityLabel={place.label}
              accessibilityHint={resultHint ?? t('planner.search.resultHint')}
              onPress={() => select(place)}
              style={({ pressed }) => [styles.result, pressed && styles.pressed]}
            >
              <Text style={styles.resultName}>{place.name}</Text>
              {place.label !== place.name ? (
                <Text style={styles.muted} numberOfLines={2}>
                  {place.label}
                </Text>
              ) : null}
            </Pressable>
          ))
        : null}
    </View>
  );
}

function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503;
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  result: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.8,
  },
  resultName: {
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
    fontSize: 14,
  },
});
