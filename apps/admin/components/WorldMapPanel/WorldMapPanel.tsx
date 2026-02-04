 'use client';

import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleQuantize } from 'd3-scale';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json' assert { type: 'json' };
import styles from './WorldMapPanel.module.css';

export type WorldMapPanelProps = {
  title: string;
  data: { countryCode: string; value: number; label?: string }[];
  titleBgColor: string;
  bodyBgColor: string;
  footerBgColor: string;
};

type TooltipState = { x: number; y: number; text: string } | null;

const colorRamp = ['#eaf4ec', '#c9e4d5', '#a6d3bb', '#7fbf9b', '#5aa17f', '#3c8b66', '#1f6c4d'];

const WorldMapPanel: React.FC<WorldMapPanelProps> = ({
  title,
  data,
  titleBgColor,
  bodyBgColor,
  footerBgColor,
}) => {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const geoFeatures = useMemo(() => {
    try {
      const raw = (feature(worldData as any, (worldData as any).objects.countries).features || []) as any[];
      return raw.filter((f) => f.properties?.NAME !== 'Antarctica');
    } catch (e) {
      return [];
    }
  }, []);

  const geoCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: geoFeatures as any[],
    }),
    [geoFeatures]
  );

  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => map.set(d.countryCode.toUpperCase(), d.value));
    return map;
  }, [data]);

  const maxVal = useMemo(
    () => Math.max(...data.map((d) => d.value), 1),
    [data]
  );

  const quantize = useMemo(
    () => scaleQuantize<string>().domain([0, maxVal]).range(colorRamp),
    [maxVal]
  );

  const footerColumns = useMemo(() => {
    const perCol = Math.ceil(data.length / 3);
    return [data.slice(0, perCol), data.slice(perCol, perCol * 2), data.slice(perCol * 2)];
  }, [data]);

  const handleEnter = (evt: React.MouseEvent<SVGPathElement>, code: string) => {
    const value = dataMap.get(code.toUpperCase());
    if (value === undefined) {
      setTooltip(null);
      return;
    }
    const rect = (evt.target as SVGPathElement).getBoundingClientRect();
    setTooltip({
      x: evt.clientX - rect.left + rect.x,
      y: evt.clientY - rect.top + rect.y,
      text: `${code.toUpperCase()}: ${value.toLocaleString()}`,
    });
  };

  const handleLeave = () => setTooltip(null);

  return (
    <div className={styles.panel}>
      <div className={styles.title} style={{ backgroundColor: titleBgColor }}>
        {title}
      </div>

      <div className={styles.body} style={{ backgroundColor: bodyBgColor }}>
        {geoFeatures.length ? (
          <>
            <ComposableMap className={styles.map} projectionConfig={{ scale: 160 }}>
              <Geographies geography={geoCollection}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const code = (geo.properties.ISO_A2 || geo.id || '').toString().toUpperCase();
                    const val = dataMap.get(code);
                    const fill = val !== undefined ? quantize(val) : '#d9d9d9';
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#4a4a4a"
                        strokeWidth={0.6}
                        onMouseEnter={(e) => handleEnter(e, code)}
                        onMouseLeave={handleLeave}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
            {tooltip && (
              <div
                className={styles.tooltip}
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                {tooltip.text}
              </div>
            )}
          </>
        ) : (
          <div className={styles.placeholder}>
            This here must be a world map with counters for the world players
          </div>
        )}
      </div>

      <div
        className={styles.footer}
        style={{
          backgroundColor: footerBgColor,
        }}
      >
        {footerColumns.map((col, idx) => (
          <div key={idx} className={styles.footerCol}>
            {col.map((item) => (
              <div key={item.countryCode} className={styles.row}>
                {item.label ?? item.countryCode} - {item.value.toLocaleString()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldMapPanel;
