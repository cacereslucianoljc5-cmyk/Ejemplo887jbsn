import React from 'react';
import { cn } from './cn.js';

// Adapted from Magic UI <Marquee/> — Tailwind classes ported to plain CSS
// (see enhance.css: .mq / .mq-row / animation `mq-scroll`).
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}) {
  return (
    <div
      {...props}
      className={cn('mq', vertical ? 'mq-v' : 'mq-h', pauseOnHover && 'mq-pause', className)}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn('mq-row', vertical ? 'mq-row-v' : 'mq-row-h', reverse && 'mq-reverse')}
          >
            {children}
          </div>
        ))}
    </div>
  );
}

export default Marquee;
