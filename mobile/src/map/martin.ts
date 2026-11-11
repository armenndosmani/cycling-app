/**
 * Names the Martin tile server uses for our map data. Kept in one place so they are easy to
 * change when the server configuration changes.
 */
export const MARTIN = {
  /** PMTiles source in the Protomaps basemap schema; its TileJSON is served at `/{name}` */
  basemapSource: 'basemap',
  /** Font endpoint: `/font/{fontstack}/{range}` */
  fontPath: 'font',
  /** Sprite endpoint: `/sprite/{name}` (MapLibre appends `.json`, `.png` and `@2x`) */
  spritePath: 'sprite',
  /** Sprite set matching the dark Protomaps flavour */
  spriteName: 'basemap-dark',
} as const;

export type MartinUrls = {
  tileJson: string;
  glyphs: string;
  sprite: string;
};

/** URLs of the basemap TileJSON, glyphs and sprite on our tile server. */
export function martinUrls(baseUrl: string): MartinUrls {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    tileJson: `${base}/${MARTIN.basemapSource}`,
    glyphs: `${base}/${MARTIN.fontPath}/{fontstack}/{range}`,
    sprite: `${base}/${MARTIN.spritePath}/${MARTIN.spriteName}`,
  };
}
