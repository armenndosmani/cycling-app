import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { layers, namedFlavor } from '@protomaps/basemaps';

import { martinUrls } from '@/map/martin';

/** Style source id the basemap layers refer to (not the Martin source name). */
export const BASEMAP_SOURCE_ID = 'protomaps';

/**
 * Attribution the OpenStreetMap licence (ODbL) asks for, shown as visible text on the map.
 * Protomaps is credited for the basemap style. Not translated: it is a licence notice.
 */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · Protomaps';

/**
 * MapLibre style for the planner: the official Protomaps dark flavour (matches the app's dark
 * theme), with tiles, glyphs and sprites from our own Martin server only.
 */
export function buildMapStyle(tilesBaseUrl: string): StyleSpecification {
  const urls = martinUrls(tilesBaseUrl);
  return {
    version: 8,
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: 'vector',
        url: urls.tileJson,
        attribution: MAP_ATTRIBUTION,
      },
    },
    glyphs: urls.glyphs,
    sprite: urls.sprite,
    layers: layers(BASEMAP_SOURCE_ID, namedFlavor('dark'), { lang: 'en' }),
  };
}
