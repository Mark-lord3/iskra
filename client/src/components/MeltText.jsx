import { useEffect, useId, useRef, useState } from 'react';

/**
 * Arcade text that melts under the pointer and re-forms when it leaves.
 *
 * Uses an SVG turbulence + displacement filter driven by requestAnimationFrame,
 * so only the filter's scale changes per frame and layout is never touched.
 * The effect is opt-in per element and is switched off entirely for touch
 * input and for prefers-reduced-motion, where it would be either unreachable
 * or unwelcome. Focus styling lives in CSS and does not depend on hover.
 */
export default function MeltText({ as: Tag = 'span', children, className = '', amount = 26, ...rest }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const dispRef = useRef(null);
  const rafRef = useRef(0);
  const target = useRef(0);
  const value = useRef(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(fine.matches && !calm.matches);
    sync();
    fine.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => { fine.removeEventListener('change', sync); calm.removeEventListener('change', sync); };
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const run = () => {
    cancelAnimationFrame(rafRef.current);
    const step = () => {
      // Ease toward the target so both melting and re-forming are smooth.
      value.current += (target.current - value.current) * 0.14;
      if (dispRef.current) dispRef.current.setAttribute('scale', value.current.toFixed(2));
      if (Math.abs(target.current - value.current) > 0.15) rafRef.current = requestAnimationFrame(step);
      else if (dispRef.current) dispRef.current.setAttribute('scale', String(target.current));
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const melt = () => { if (!enabled) return; target.current = amount; run(); };
  const reform = () => { if (!enabled) return; target.current = 0; run(); };

  return (
    <Tag
      className={`melt ${className}`}
      style={enabled ? { filter: `url(#${id})` } : undefined}
      onPointerEnter={e => { if (e.pointerType === 'mouse') melt(); }}
      onPointerLeave={reform}
      {...rest}
    >
      {children}
      {enabled && (
        <svg className="melt-defs" aria-hidden="true" focusable="false" width="0" height="0">
          <filter id={id} x="-20%" y="-20%" width="140%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.055" numOctaves="2" seed="7" result="noise">
              <animate attributeName="baseFrequency" dur="14s"
                       values="0.008 0.055;0.012 0.075;0.008 0.055" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="noise" scale="0"
                               xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </Tag>
  );
}
