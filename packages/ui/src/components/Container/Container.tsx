import * as React from 'react';
import styles from './Container.module.css';
import { cn } from '../../utils/cn';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  size?: ContainerSize;
  as?: React.ElementType;
}

export const Container = React.forwardRef<HTMLElement, ContainerProps>(function Container(
  { size = 'lg', as: Component = 'div', className, children, ...props },
  ref
) {
  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={cn(styles.container, styles[`size-${size}`], className)}
      {...props}
    >
      {children}
    </Component>
  );
});

Container.displayName = 'Container';
