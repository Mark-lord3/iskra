import { useEffect, useState } from 'react';

/**
 * The reader's motion preference, watched live so a change in system settings
 * takes effect without a reload. One implementation for the whole site.
 */
export function useReducedMotion(){
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if(typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = event => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Decorative animation stops while the tab is hidden. */
export function usePageVisible(){
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/** True once the element has scrolled into view; fires one time. */
export function useInView(ref, { threshold = 0.25, once = true } = {}){
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if(!node || typeof IntersectionObserver !== 'function'){ setSeen(true); return; }
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries){
        if(entry.isIntersecting){ setSeen(true); if(once) observer.disconnect(); }
        else if(!once) setSeen(false);
      }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, once]);
  return seen;
}
