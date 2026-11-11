import { describe, expect, it } from 'vitest';

import { buildMapStyle, MAP_ATTRIBUTION } from '@/map/mapStyle';
import { martinUrls } from '@/map/martin';

describe('martinUrls', () => {
  it('builds the tile, glyph and sprite URLs', () => {
    expect(martinUrls('http://tiles.test:3000/')).toEqual({
      tileJson: 'http://tiles.test:3000/basemap',
      glyphs: 'http://tiles.test:3000/font/{fontstack}/{range}',
      sprite: 'http://tiles.test:3000/sprite/basemap-dark',
    });
  });
});

describe('buildMapStyle', () => {
  const style = buildMapStyle('http://tiles.test:3000');

  it('loads everything from our tile server only', () => {
    const urls = JSON.stringify(style).match(/https?:\/\/[^"\s]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith('http://tiles.test:3000/')).toBe(true);
    }
  });

  it('uses the Protomaps layers with OSM attribution', () => {
    expect(style.layers.length).toBeGreaterThan(20);
    const source = style.sources.protomaps;
    expect(source).toMatchObject({ type: 'vector', url: 'http://tiles.test:3000/basemap' });
    expect(MAP_ATTRIBUTION).toContain('© OpenStreetMap contributors');
  });

  it('uses one font per text-font stack (the tile server serves no combined stacks)', () => {
    for (const layer of style.layers) {
      const font = (layer as { layout?: Record<string, unknown> }).layout?.['text-font'];
      if (Array.isArray(font) && font.every((f) => typeof f === 'string')) {
        expect(font).toHaveLength(1);
      }
    }
  });
});
