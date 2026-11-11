import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation,
  type CameraRef,
  type InitialViewState,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { LatLon, LineString } from '@/api/routes';
import { MapAttribution } from '@/components/map/MapAttribution';
import { DEFAULT_VIEWPORT } from '@/components/planner/PlannerMap';
import { colors } from '@/constants/theme';
import { appMapStyle } from '@/map/appMapStyle';
import { boundsOf } from '@/planner/geo';
import { circleRing, type MeetingDisplay } from '@/rides/display';

/** Zoom around a single meeting point */
export const MEETING_POINT_ZOOM = 14;
const MEETING_AREA_ZOOM = 13;

type Props = {
  /** Route line; pass it only for the admin and participants */
  route: LineString | null;
  meeting: MeetingDisplay;
  /** [lon, lat] marked from the elevation profile */
  highlight?: [number, number] | null;
  /** Map label for screen readers (what the map shows) */
  accessibilityLabel: string;
  /** Label of the meeting point marker */
  meetingPointLabel: string;
  /** Set when the map is used to pick the meeting point */
  onPress?: (position: LatLon) => void;
  cameraRef?: RefObject<CameraRef | null>;
};

const toLatLon = ([lon, lat]: LngLat): LatLon => ({ lat, lon });

function initialView(route: LineString | null, meeting: MeetingDisplay): InitialViewState {
  const padding = { top: 40, right: 40, bottom: 40, left: 40 };
  const coordinates: [number, number][] = route
    ? route.coordinates.map(([lon, lat]) => [lon, lat])
    : [];
  if (meeting.kind === 'exact') coordinates.push([meeting.point.lon, meeting.point.lat]);
  if (route) {
    const bounds = boundsOf(coordinates);
    if (bounds) return { bounds, padding };
  }
  if (meeting.kind === 'exact') {
    return { center: [meeting.point.lon, meeting.point.lat], zoom: MEETING_POINT_ZOOM };
  }
  if (meeting.kind === 'area') {
    return { center: [meeting.center.lon, meeting.center.lat], zoom: MEETING_AREA_ZOOM };
  }
  return { center: DEFAULT_VIEWPORT.center, zoom: DEFAULT_VIEWPORT.zoom };
}

/**
 * A ride on the map: the route and the exact meeting point for the admin and participants, or
 * only the generalised meeting area (a circle, never a point) for everyone else. Uses the same
 * self-hosted style as the planner.
 */
export function RideMap({
  route,
  meeting,
  highlight = null,
  accessibilityLabel,
  meetingPointLabel,
  onPress,
  cameraRef,
}: Props) {
  const { t } = useTranslation();
  // Only the first value counts; later moves go through the camera ref
  const [initialViewState] = useState(() => initialView(route, meeting));

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={appMapStyle}
        accessibilityLabel={accessibilityLabel}
        attribution={false}
        logo={false}
        compass
        touchPitch={false}
        onPress={onPress ? (event) => onPress(toLatLon(event.nativeEvent.lngLat)) : undefined}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />

        {route ? (
          <GeoJSONSource
            id="ride-route"
            data={{ type: 'Feature', properties: {}, geometry: route }}
          >
            <Layer
              id="ride-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.background, 'line-width': 9 }}
            />
            <Layer
              id="ride-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.accent, 'line-width': 5 }}
            />
          </GeoJSONSource>
        ) : null}

        {meeting.kind === 'area' ? (
          <GeoJSONSource
            id="meeting-area"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [circleRing(meeting.center, meeting.radiusMeters)],
              },
            }}
          >
            <Layer
              id="meeting-area-fill"
              type="fill"
              paint={{ 'fill-color': colors.accent, 'fill-opacity': 0.2 }}
            />
            <Layer
              id="meeting-area-outline"
              type="line"
              paint={{ 'line-color': colors.accent, 'line-width': 2, 'line-dasharray': [2, 2] }}
            />
          </GeoJSONSource>
        ) : null}

        {highlight ? (
          <GeoJSONSource
            id="ride-profile-position"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: highlight },
            }}
          >
            <Layer
              id="ride-profile-position-circle"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': colors.text,
                'circle-stroke-color': colors.background,
                'circle-stroke-width': 3,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {meeting.kind === 'exact' ? (
          <ViewAnnotation
            id="meeting-point"
            lngLat={[meeting.point.lon, meeting.point.lat]}
            title={meetingPointLabel}
          >
            <View style={styles.marker} accessibilityLabel={meetingPointLabel}>
              {/* Fixed-size map symbol; the screen shows the same information as text */}
              <Text style={styles.markerText} maxFontSizeMultiplier={1}>
                {t('rides.form.meetingPointMarker')}
              </Text>
            </View>
          </ViewAnnotation>
        ) : null}
      </Map>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.accent,
  },
  markerText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
});
