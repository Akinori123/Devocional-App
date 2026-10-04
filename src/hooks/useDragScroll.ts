import { useRef, useCallback } from 'react';

/**
 * Hook to enable smooth click-and-drag horizontal scrolling on desktop/PC,
 * along with vertical-to-horizontal mouse wheel support.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    isDown.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onMouseLeave = useCallback(() => {
    isDown.current = false;
  }, []);

  const onMouseUp = useCallback(() => {
    isDown.current = false;
    setTimeout(() => {
      hasDragged.current = false;
    }, 80);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDown.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const delta = x - startX.current;
    if (Math.abs(delta) > 5) {
      hasDragged.current = true;
    }
    const walk = delta * 1.5; // Scroll speed factor
    ref.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!ref.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      ref.current.scrollLeft += e.deltaY;
    }
  }, []);

  return {
    ref,
    hasDragged,
    dragProps: {
      ref,
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove,
      onWheel,
    }
  };
}
