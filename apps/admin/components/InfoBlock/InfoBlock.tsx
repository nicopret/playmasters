import React from 'react';
import styles from './InfoBlock.module.css';

export type InfoBlockProps = {
  title: string;
  value: string | number;
  data: number[];
  fontColor: string;
  titleBgColor: string;
  valueBgColor: string;
  footerBgColor: string;
};

const InfoBlock: React.FC<InfoBlockProps> = ({
  title,
  value,
  data,
  fontColor,
  titleBgColor,
  valueBgColor,
  footerBgColor,
}) => {
  const safeData = data && data.length ? data : [0];
  const maxValue = Math.max(...safeData, 1);
console.log({maxValue})
  return (
    <div className={styles.block}>
      <div
        className={styles.header}
        style={{ backgroundColor: titleBgColor, color: fontColor }}
      >
        {title}
      </div>

      <div
        className={styles.value}
        style={{ backgroundColor: valueBgColor, color: fontColor }}
      >
        {value}
      </div>

      <div
        className={styles.footer}
        style={{ backgroundColor: footerBgColor }}
      >
        <div className={styles.baseline} />
        <div className={styles.barWrap}>
          {safeData.map((point, idx) => {
            const heightPercent = (point / maxValue) * 100;
            return (
              <span
                key={`${title}-${idx}`}
                className={styles.bar}
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: titleBgColor,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InfoBlock;
