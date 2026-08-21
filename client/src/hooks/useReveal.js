import { useEffect } from 'react';

// Fades sections in as they enter the viewport. Re-runs whenever `deps` change
// so content rendered after an API response also gets observed.
export function useReveal(deps = []) {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    document.querySelectorAll('.rv:not(.in)').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
