import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation,
  type CameraRef,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { CalculatedRoute, LatLon } from '@/api/routes';
import { MapAttribution } from '@/components/map/MapAttribution';
import { colors } from '@/constants/theme';
import { appMapStyle } from '@/map/appMapStyle';
import type { CameraRequest, Viewport } from '@/planner/plannerStore';
import type { ListedPoint } from '@/planner/points';

/** Shown until the rider has looked at another area (development data covers Luxembourg). */
export const DEFAULT_VIEWPORT: Viewport = { center: [6.13, 49.61], zoom: 9 };

type Props = {
  points: ListedPoint[];
  route: CalculatedRoute | null;
  /** Draw the route dimmed: it belongs to earlier points and a new one is calculating */
  outdated: boolean;
  /** [lon, lat] marked from the elevation profile */
  highlight: [number, number] | null;
  initialViewport: Viewport;
  camera: CameraRequest | null;
  cameraRef: RefObject<CameraRef | null>;
  onPress: (position: LatLon) => void;
  onMovePoint: (id: string, position: LatLon) => void;
  onViewportChange: (viewport: Viewport) => void;
  /** The camera request has been carried out */
  onCameraDone: (id: number) => void;
  pointLabel: (point: ListedPoint) => string;
};

const toLatLon = ([lon, lat]: LngLat): LatLon => ({ lat, lon });

export function PlannerMap({
  points,
  route,
  outdated,
  highlight,
  initialViewport,
  camera,
  cameraRef,
  onPress,
  onMovePoint,
  onViewportChange,
  onCameraDone,
  pointLabel,
}: Props) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  // Only the first value counts; later camera moves go through the effect below
  const [initialViewState] = useState(() =>
    camera
      ? { bounds: camera.bounds }
      : { center: initialViewport.center, zoom: initialViewport.zoom },
  );

  // Fit the map to a route that was opened from "My routes", once
  useEffect(() => {
    if (!loaded || !camera) return;
    cameraRef.current?.fitBounds(camera.bounds, {
      padding: { top: 140, right: 40, bottom: 40, left: 40 },
      duration: 600,
    });
    onCameraDone(camera.id);
  }, [loaded, camera, cameraRef, onCameraDone]);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={appMapStyle}
        accessibilityLabel={t('planner.mapLabel')}
        // The licence notice is shown as visible text below instead of the info button
        attribution={false}
        logo={false}
        compass
        // Below the "Use my location" button
        compassPosition={{ top: 72, right: 12 }}
        touchPitch={false}
        onDidFinishLoadingMap={() => setLoaded(true)}
        onPress={(event) => onPress(toLatLon(event.nativeEvent.lngLat))}
        onRegionDidChange={(event) =>
          onViewportChange({ center: event.nativeEvent.center, zoom: event.nativeEvent.zoom })
        }
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />

        {route ? (
          <GeoJSONSource
            id="route"
            data={{ type: 'Feature', properties: {}, geometry: route.geometry }}
          >
            <Layer
              id="route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.background, 'line-width': 9 }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': colors.accent,
                'line-width': 5,
                'line-opacity': outdated ? 0.45 : 1,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {highlight ? (
          <GeoJSONSource
            id="profile-position"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: highlight },
            }}
          >
            <Layer
              id="profile-position-circle"
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

        {points.map((listed) => (
          <ViewAnnotation
            key={listed.point.id}
            id={listed.point.id}
            lngLat={[listed.point.lon, listed.point.lat]}
            draggable
            title={pointLabel(listed)}
            onDragEnd={(event) => onMovePoint(listed.point.id, toLatLon(event.nativeEvent.lngLat))}
          >
            <View
              style={[
                styles.marker,
                listed.role === 'waypoint' ? styles.waypoint : styles.endpoint,
              ]}
              accessibilityLabel={pointLabel(listed)}
              accessibilityHint={t('planner.points.markerHint')}
            >
              {/* Fixed-size map symbol: larger text would not fit the marker. The points list
                  below the map shows the same information in scalable text. */}
              <Text
                style={listed.role === 'waypoint' ? styles.waypointText : styles.endpointText}
                maxFontSizeMultiplier={1}
              >
                {markerText(listed)}
              </Text>
            </View>
          </ViewAnnotation>
        ))}
      </Map>

      <MapAttribution />
    </View>
  );
}

/** Letter or number on the marker: A start, B destination, 1..25 stops. Shape differs too. */
function markerText({ role, index }: ListedPoint): string {
  if (role === 'start') return 'A';
  if (role === 'destination') return 'B';
  return String(index + 1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  endpoint: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
  },
  waypoint: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.text,
  },
  endpointText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  waypointText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
