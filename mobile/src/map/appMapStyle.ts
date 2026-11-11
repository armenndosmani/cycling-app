import { getTilesBaseUrl } from '@/config/tiles';
import { buildMapStyle } from '@/map/mapStyle';

/** The app's map style, built once: it is large and never changes while the app runs. */
export const appMapStyle = buildMapStyle(getTilesBaseUrl());
