import { clsx } from 'clsx';

// Minimal cn() — this project has no Tailwind, so we just join class names.
export function cn(...inputs) {
  return clsx(inputs);
}
