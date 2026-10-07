import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to enable smooth click-and-drag horizontal scrolling on desktop/PC,
 * along with vertical-to-horizontal mouse wheel support and click prevention when dragging.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDown.current || !ref.current) return;
      const delta = e.clientX - startX.current;
      if (Math.abs(delta) > 3) {
        hasDragged.current = true;
        ref.current.scrollLeft = startScrollLeft.current - delta;
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDown.current) {
        isDown.current = false;
        setTimeout(() => {
          hasDragged.current = false;
        }, 120);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<T>) => {
    if (!ref.current) return;
    // Only drag on primary (left) mouse button
    if (e.button !== 0) return;
    isDown.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    startScrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<T>) => {
    if (!ref.current) return;
    if (Math.abs(e.deltaY) > 0) {
      ref.current.scrollLeft += e.deltaY;
    }
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const scrollBy = useCallback((amount: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }, []);

  return {
    ref,
    hasDragged,
    scrollBy,
    dragProps: {
      ref,
      onMouseDown,
      onWheel,
      onClickCapture,
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
    }
  };
}
