import type { CameraRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CalculatedRoute, LatLon, Place } from '@/api/routes';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { DisciplinePicker } from '@/components/planner/DisciplinePicker';
import { ElevationProfile } from '@/components/planner/ElevationProfile';
import { PlaceSearch } from '@/components/planner/PlaceSearch';
import { DEFAULT_VIEWPORT, PlannerMap } from '@/components/planner/PlannerMap';
import { PointList } from '@/components/planner/PointList';
import { RouteSummary } from '@/components/planner/RouteSummary';
import { colors } from '@/constants/theme';
import { confirmDiscard } from '@/planner/confirmDiscard';
import { positionAtFraction } from '@/planner/geo';
import { canUndo } from '@/planner/history';
import { effectiveDiscipline, plannerStore } from '@/planner/plannerStore';
import {
  addPoint,
  createPoint,
  listPoints,
  makeLoop,
  MAX_WAYPOINTS,
  movePoint,
  removePoint,
  reorderWaypoint,
  type EditResult,
  type ListedPoint,
  type RoutePoints,
} from '@/planner/points';
import { usePlannerState, useRouteCalculation } from '@/planner/usePlanner';

/** Zoom when centring on the rider's location or a searched place */
const FOCUS_ZOOM = 14;

export default function PlannerScreen() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const state = usePlannerState();
  const cameraRef = useRef<CameraRef>(null);
  const [message, setMessage] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [selection, setSelection] = useState<{ route: CalculatedRoute; distance: number }>();

  const points = state.history.present;
  const discipline = effectiveDiscipline(state.discipline, me?.bicycleTypes);
  const calculation = useRouteCalculation(points, discipline, state.route);
  const listed = listPoints(points);
  const route = calculation.route;

  const pointLabel = ({ role, index }: ListedPoint) =>
    role === 'waypoint'
      ? t('planner.points.waypoint', { number: index + 1 })
      : t(`planner.points.${role}`);

  const edit = (change: (current: RoutePoints) => EditResult | RoutePoints) => {
    const result = plannerStore.edit(change);
    setMessage(result.ok ? undefined : t('planner.waypointLimit', { max: MAX_WAYPOINTS }));
  };

  const addAt = (position: LatLon, name?: string) =>
    edit((current) => addPoint(current, createPoint(position, name)));

  const selectPlace = (place: Place) => {
    addAt({ lat: place.lat, lon: place.lon }, place.name);
    cameraRef.current?.easeTo({ center: [place.lon, place.lat], zoom: FOCUS_ZOOM, duration: 600 });
  };

  // One-time "near me": foreground permission only, asked when tapped; the position only
  // moves the map and is never stored or sent anywhere.
  const centreOnMyLocation = async () => {
    setMessage(undefined);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setMessage(t('planner.locationDenied'));
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      cameraRef.current?.easeTo({
        center: [coords.longitude, coords.latitude],
        zoom: FOCUS_ZOOM,
        duration: 600,
      });
    } catch {
      setMessage(t('planner.locationUnavailable'));
    } finally {
      setLocating(false);
    }
  };

  const highlight =
    route && selection?.route === route && route.elevationProfile.length >= 2
      ? positionAtFraction(route.geometry.coordinates, fractionOf(route, selection.distance))
      : null;

  const hint = !points.start
    ? t('planner.hint.start')
    : !points.destination
      ? t('planner.hint.destination')
      : t('planner.hint.editing');

  const near: LatLon | null = state.viewport
    ? { lat: state.viewport.center[1], lon: state.viewport.center[0] }
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mapArea}>
          <PlannerMap
            points={listed}
            route={route}
            outdated={calculation.outdated}
            highlight={highlight}
            initialViewport={state.viewport ?? DEFAULT_VIEWPORT}
            camera={state.camera}
            cameraRef={cameraRef}
            onPress={(position) => addAt(position)}
            onMovePoint={(id, position) => edit((current) => movePoint(current, id, position))}
            onViewportChange={(viewport) => plannerStore.setViewport(viewport)}
            onCameraDone={(id) => plannerStore.cameraDone(id)}
            pointLabel={pointLabel}
          />
          <View style={styles.mapButtons}>
            <Button
              variant="secondary"
              label={t('planner.useMyLocation')}
              accessibilityHint={t('planner.useMyLocationHint')}
              onPress={centreOnMyLocation}
              busy={locating}
            />
          </View>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>{hint}</Text>
          <FormMessage message={message} />

          {state.saved ? (
            <Text style={styles.muted}>
              {t('planner.status.editing', { name: state.saved.name })}
            </Text>
          ) : null}
          {state.dirty ? <Text style={styles.muted}>{t('planner.status.unsaved')}</Text> : null}

          <DisciplinePicker
            value={discipline}
            onChange={(next) => plannerStore.setDiscipline(next)}
          />

          <PlaceSearch near={near} onSelect={selectPlace} />

          <RouteSummary status={calculation.status} route={route} onRetry={calculation.retry} />

          {route && !calculation.outdated ? (
            <ElevationProfile
              profile={route.elevationProfile}
              selected={selection?.route === route ? selection.distance : null}
              onSelect={(distance) => setSelection({ route, distance })}
            />
          ) : null}

          <PointList
            points={listed}
            waypointCount={points.waypoints.length}
            pointLabel={pointLabel}
            onRemove={(id) => edit((current) => removePoint(current, id))}
            onReorder={(id, direction) =>
              edit((current) => reorderWaypoint(current, id, direction))
            }
          />

          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={t('planner.actions.undo')}
              accessibilityHint={t('planner.actions.undoHint')}
              onPress={() => {
                setMessage(undefined);
                plannerStore.undo();
              }}
              disabled={!canUndo(state.history)}
            />
            {points.start && !points.destination ? (
              <Button
                variant="secondary"
                label={t('planner.actions.loop')}
                accessibilityHint={t('planner.actions.loopHint')}
                onPress={() => edit(makeLoop)}
              />
            ) : null}
            <Button
              label={t('planner.actions.save')}
              accessibilityHint={t('planner.actions.saveHint')}
              onPress={() => router.push('/save-route')}
              disabled={calculation.status.kind !== 'ready'}
            />
          </View>
          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={t('planner.actions.newRoute')}
              onPress={() =>
                confirmDiscard(() => {
                  setMessage(undefined);
                  plannerStore.startNew();
                })
              }
              disabled={listed.length === 0 && !state.saved}
            />
            <Button
              variant="secondary"
              label={t('planner.actions.myRoutes')}
              onPress={() => router.push('/routes')}
            />
            {state.saved && !state.dirty ? (
              <Button
                variant="secondary"
                label={t('planner.actions.createRide')}
                accessibilityHint={t('planner.actions.createRideHint')}
                onPress={() =>
                  router.push({
                    pathname: '/ride-form',
                    params: { routeId: state.saved?.id ?? '' },
                  })
                }
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Where `distance` lies along the profile, from 0 to 1. */
function fractionOf(route: CalculatedRoute, distance: number): number {
  const profile = route.elevationProfile;
  const start = profile[0][0];
  const length = profile[profile.length - 1][0] - start;
  return length > 0 ? (distance - start) / length : 0;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapArea: {
    flex: 11,
  },
  mapButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  panel: {
    flex: 10,
    backgroundColor: colors.surface,
  },
  panelContent: {
    gap: 14,
    padding: 16,
  },
  hint: {
    color: colors.text,
    fontSize: 15,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
