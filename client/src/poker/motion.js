
/**
 * Shared motion tokens.
 *
 * Every poker animation reads its duration from here so the whole table stays
 * in step, and so reduced motion can collapse the entire system by swapping one
 * multiplier rather than by editing dozens of components.
 */
export const MOTION = {
  /* Physical objects: cards and chips travel with a spring. */
  deal:        { duration: 260, stagger: 55,  easing: 'cubic-bezier(.2,.9,.28,1.06)' },
  flip:        { duration: 320, easing: 'cubic-bezier(.34,1.32,.44,1)' },
  chipToPot:   { duration: 340, easing: 'cubic-bezier(.3,.85,.3,1.02)' },
  potToWinner: { duration: 520, easing: 'cubic-bezier(.25,.8,.25,1)' },
  muck:        { duration: 300, easing: 'cubic-bezier(.4,0,.7,.2)' },

  /* Interface: controls, labels and status move with short eased transitions. */
  control:     { duration: 140, easing: 'cubic-bezier(.22,.68,0,1)' },
  label:       { duration: 180, easing: 'cubic-bezier(.22,.68,0,1)' },
  announce:    { duration: 220, hold: 1400, easing: 'cubic-bezier(.22,.68,0,1)' },
  stage:       { duration: 620, hold: 2200, easing: 'cubic-bezier(.22,.68,0,1)' },
  celebrate:   { duration: 900, hold: 2600, easing: 'cubic-bezier(.22,.68,0,1)' },

  /* Continuous cues. */
  turnPulse:   { duration: 1600 },
  elevation:   { seat: '0 10px 24px rgba(0,0,0,.4)', lift: '0 18px 40px rgba(0,0,0,.55)' },
  glow:        { spark: '0 0 0 3px rgba(255,92,26,.22)', win: '0 0 0 3px rgba(198,255,61,.35)' }
};

/** How long a whole event takes to play, used by the queue to pace itself. */
export function durationOf(event, reduced = false){
  if(reduced) return 0;
  const table = {
    deal:      MOTION.deal.duration + MOTION.deal.stagger * (event.count || 1),
    flip:      MOTION.flip.duration,
    bet:       MOTION.chipToPot.duration,
    collect:   MOTION.chipToPot.duration,
    fold:      MOTION.muck.duration,
    award:     MOTION.potToWinner.duration,
    showdown:  MOTION.flip.duration + 240,
    announce:  MOTION.announce.duration,
    eliminate: MOTION.announce.duration + 200,
    stage:     MOTION.stage.duration,
    celebrate: MOTION.celebrate.duration
  };
  return table[event.type] ?? MOTION.label.duration;
}

/* Motion preference and tab visibility are shared with the rest of the site. */
export { useReducedMotion, usePageVisible } from '../hooks/useMotionPrefs.js';

/** Expose the tokens to CSS so stylesheets and JS never drift apart. */
export function motionStyle(reduced){
  return {
    '--m-deal': `${reduced ? 0 : MOTION.deal.duration}ms`,
    '--m-flip': `${reduced ? 0 : MOTION.flip.duration}ms`,
    '--m-chip': `${reduced ? 0 : MOTION.chipToPot.duration}ms`,
    '--m-award': `${reduced ? 0 : MOTION.potToWinner.duration}ms`,
    '--m-control': `${reduced ? 0 : MOTION.control.duration}ms`,
    '--m-label': `${reduced ? 0 : MOTION.label.duration}ms`,
    '--m-pulse': `${reduced ? 0 : MOTION.turnPulse.duration}ms`,
    '--m-ease-card': MOTION.deal.easing,
    '--m-ease-flip': MOTION.flip.easing,
    '--m-ease-ui': MOTION.control.easing
  };
}
