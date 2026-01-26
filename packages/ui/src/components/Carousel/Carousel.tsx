import * as React from 'react';
import styles from './Carousel.module.css';
import { Button } from '../Button/Button';
import { cn } from '../../utils/cn';

export type CarouselItem = {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  items: CarouselItem[];
  maxItems?: number;
  autoPlay?: boolean;
  intervalMs?: number;
}

export const Carousel: React.FC<CarouselProps> = ({
  items,
  maxItems = 5,
  autoPlay = true,
  intervalMs = 7000,
  className,
  ...props
}) => {
  const limitedItems = React.useMemo(
    () => items.slice(0, Math.min(maxItems, 5)),
    [items, maxItems]
  );

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [userPaused, setUserPaused] = React.useState(false);

  React.useEffect(() => {
    if (!autoPlay || isHovered || userPaused || limitedItems.length <= 1) {
      return;
    }

    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % limitedItems.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [autoPlay, isHovered, userPaused, limitedItems.length, intervalMs]);

  const goTo = (index: number) => {
    if (!limitedItems.length) return;
    const nextIndex = (index + limitedItems.length) % limitedItems.length;
    setCurrentIndex(nextIndex);
    setUserPaused(true);
  };

  const handlePrev = () => goTo(currentIndex - 1);
  const handleNext = () => goTo(currentIndex + 1);

  if (!limitedItems.length) return null;

  const activeItem = limitedItems[currentIndex];

  return (
    <div
      className={cn(styles.carousel, className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <div
        className={styles.slide}
        aria-live="polite"
        id={`carousel-panel-${activeItem.id}`}
        role="group"
        aria-label={`${activeItem.title}`}
      >
        <div className={styles.text}>
          <div className={styles.title}>{activeItem.title}</div>
          {activeItem.body ? <div className={styles.body}>{activeItem.body}</div> : null}
          {activeItem.ctaLabel && activeItem.ctaHref ? (
            <div className={styles.cta}>
              <Button as="a" href={activeItem.ctaHref} variant="primary" size="md">
                {activeItem.ctaLabel}
              </Button>
            </div>
          ) : null}
          <div className={styles.muted}>
            {currentIndex + 1} / {limitedItems.length}
          </div>
        </div>
        {activeItem.imageUrl ? (
          <img className={styles.image} src={activeItem.imageUrl} alt={activeItem.title} />
        ) : null}
      </div>

      {limitedItems.length > 1 ? (
        <>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={handlePrev}
              aria-label="Previous announcement"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.controlButton}
              onClick={handleNext}
              aria-label="Next announcement"
            >
              ›
            </button>
          </div>

          <div className={styles.dots} role="tablist" aria-label="Carousel slides">
            {limitedItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-controls={`carousel-panel-${item.id}`}
                className={cn(styles.dot, index === currentIndex && styles.dotActive)}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
