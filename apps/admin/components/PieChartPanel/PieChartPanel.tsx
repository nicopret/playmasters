 'use client';

import React from 'react';
import styles from './PieChartPanel.module.css';

export type PieChartPanelProps = {
  title: string;
  data: { label: string; value: number }[];
  titleBgColor: string;
  legendBgColor: string;
  pieAreaBgColor: string;
};

const PALETTE = [
  '#e9f1ff', // soft blue (matches Active Players footer)
  '#d5e7d9', // soft green (matches Daily £ Income footer)
  '#f9f3d6', // soft yellow (matches Daily Play Hours footer)
  '#f8dddd', // soft red (matches Registered Players footer)
  '#e6e6f7', // pastel lavender
  '#d9eef2', // pastel teal
  '#f2e3f5', // pastel pink-lilac
  '#eaf2d6', // pastel lime
  '#ffe8d6', // pastel peach
  '#dfe9ff', // pastel periwinkle
];

const radius = 90;
const center = 100;

function polarToCartesian(angle: number, r = radius) {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
    x: center + r * Math.cos(rad),
    y: center + r * Math.sin(rad),
  };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

const PieChartPanel: React.FC<PieChartPanelProps> = ({
  title,
  data,
  titleBgColor,
  legendBgColor,
  pieAreaBgColor,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  let currentAngle = 0;
  const slices = data.map((item, idx) => {
    const sliceAngle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const midAngle = startAngle + sliceAngle / 2;
    const labelPoint = polarToCartesian(midAngle, radius * 0.55);
    const percent = Math.round((item.value / total) * 100);
    const labelText = `${percent}%`;

    return {
      path: arcPath(startAngle, endAngle),
      color: PALETTE[idx % PALETTE.length],
      label: labelText,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      key: item.label || idx,
    };
  });

  return (
    <div className={styles.panel}>
      <div className={styles.title} style={{ backgroundColor: titleBgColor }}>
        {title}
      </div>
      <div className={styles.body}>
        <div className={styles.pieArea} style={{ backgroundColor: pieAreaBgColor }}>
          <svg viewBox="0 0 200 200" className={styles.pie}>
            {slices.map((slice, idx) => (
              <g key={`${slice.key}-${idx}`}>
                <path
                  d={slice.path}
                  fill={slice.color}
                  stroke="#111"
                  strokeWidth={2}
                />
                <text
                  x={slice.labelX}
                  y={slice.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.pieLabel}
                >
                  {slice.label}
                </text>
              </g>
            ))}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#111"
                strokeWidth={2}
              />
          </svg>
        </div>
        <div className={styles.legend} style={{ backgroundColor: legendBgColor }}>
          {data.map((item, idx) => (
            <div key={item.label} className={styles.legendRow}>
              <span className={styles.legendSwatch} style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
              <span className={styles.legendText}>
                {item.label} - {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChartPanel;
