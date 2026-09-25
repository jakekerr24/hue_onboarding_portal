import { useLayoutEffect, useState } from 'react';

// Current pixel width of the element behind `ref`, kept up to date on resize.
// Falls back to `fallback` where layout isn't available (e.g. tests).
export function useElementWidth(ref, fallback = 800) {
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => setWidth(element.clientWidth || fallback);
    update();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fallback]);

  return width;
}
