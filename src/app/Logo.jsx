import React from 'react';

/* The Fledge mark: a fledgling bird / upward launch glyph.
   The chevron reads at once as wings taking flight and a launch trajectory. */
export function Mark({ size = 24, stroke = '#0B0B0C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke={stroke} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 56 L50 30 L72 56" />
        <path d="M50 30 L50 76" />
      </g>
    </svg>
  );
}

export default function Logo({ wordmark = true, invert = false }) {
  return (
    <div className="brand">
      <div className="logo-badge" style={invert ? { background: '#CCFF01' } : undefined}>
        <Mark size={24} stroke="#0B0B0C" />
      </div>
      {wordmark && (
        <span className="wordmark" style={invert ? { color: '#FBFBF6' } : undefined}>
          Fledge
        </span>
      )}
    </div>
  );
}
