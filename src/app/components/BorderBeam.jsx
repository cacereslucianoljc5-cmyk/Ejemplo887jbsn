import React from 'react';
import { motion } from 'motion/react';
import { cn } from './cn.js';

// From Magic UI <BorderBeam/> — a light travelling around the element border
// via CSS offset-path. Parent must be position:relative + rounded.
export function BorderBeam({
  className,
  size = 60,
  delay = 0,
  duration = 6,
  colorFrom = '#CCFF01',
  colorTo = '#B6E600',
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
}) {
  return (
    <div
      className="border-beam-wrap"
      style={{ '--border-beam-width': `${borderWidth}px` }}
    >
      <motion.div
        className={cn('border-beam', className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  );
}

export default BorderBeam;
