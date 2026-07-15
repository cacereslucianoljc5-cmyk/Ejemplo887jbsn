import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Reveals every [data-anim] element on scroll — one by one, none skipped.
 * Elements that enter together are staggered so each section animates
 * element-by-element. Respects prefers-reduced-motion.
 */
export function useReveal(scopeRef) {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add('no-anim');
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set('[data-anim]', { opacity: 0, y: 30 });

      ScrollTrigger.batch('[data-anim]', {
        start: 'top 90%',
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            stagger: 0.09,
            overwrite: true,
          }),
      });

      // ensure everything above the fold settles even without a scroll event
      ScrollTrigger.refresh();
    }, scopeRef);

    return () => ctx.revert();
  }, [scopeRef]);
}
