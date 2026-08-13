import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Reply } from 'lucide-react';

const REPLY_THRESHOLD_PX = 52;
const MAX_DRAG_PX = 72;
const LONG_PRESS_MS = 900;
const LONG_PRESS_MOVE_PX = 12;

interface ChatSwipeReplyProps {
  side: 'left' | 'right';
  onReply: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/** Przesuń bańkę w stronę środka czatu → odpowiedź (Messenger / WhatsApp). */
export function ChatSwipeReply({
  side,
  onReply,
  onLongPress,
  disabled = false,
  children,
  className = '',
}: ChatSwipeReplyProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const axisRef = useRef<'none' | 'x' | 'y'>('none');
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const inwardSign = side === 'left' ? 1 : -1;

  const clampOffset = useCallback(
    (raw: number) => {
      const signed = raw * inwardSign;
      if (signed <= 0) return 0;
      return Math.min(signed, MAX_DRAG_PX) * inwardSign;
    },
    [inwardSign],
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const resetGesture = () => {
    activeRef.current = false;
    pointerIdRef.current = null;
    axisRef.current = 'none';
    offsetRef.current = 0;
    setDragging(false);
    setOffsetX(0);
  };

  const fireLongPress = () => {
    longPressTimerRef.current = null;
    longPressFiredRef.current = true;
    resetGesture();
    onLongPress?.();
    navigator.vibrate?.(10);
  };

  const startLongPressTimer = () => {
    if (!onLongPress) return;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(fireLongPress, LONG_PRESS_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    clearLongPress();
    longPressFiredRef.current = false;
    activeRef.current = true;
    axisRef.current = 'none';
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setDragging(false);

    if (onLongPress && e.pointerType !== 'mouse') {
      startLongPressTimer();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) clearLongPress();

    if (axisRef.current === 'none') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axisRef.current === 'y') {
        resetGesture();
        return;
      }
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    if (axisRef.current !== 'x') return;

    const next = clampOffset(dx);
    offsetRef.current = next;
    setOffsetX(next);
  };

  const finish = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    clearLongPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      resetGesture();
      return;
    }
    const wasHorizontal = axisRef.current === 'x';
    activeRef.current = false;
    pointerIdRef.current = null;
    axisRef.current = 'none';
    setDragging(false);

    const triggered = wasHorizontal && Math.abs(offsetRef.current) >= REPLY_THRESHOLD_PX;
    offsetRef.current = 0;
    setOffsetX(0);

    if (triggered) onReply();

    if (wasHorizontal) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || !onLongPress || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressFiredRef.current = false;
    startLongPressTimer();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > LONG_PRESS_MOVE_PX) {
      clearLongPress();
      touchStartRef.current = null;
    }
  };

  const onTouchEnd = () => {
    clearLongPress();
    touchStartRef.current = null;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (disabled || !onLongPress) return;
    if (window.matchMedia('(max-width: 767px)').matches) {
      e.preventDefault();
      clearLongPress();
      fireLongPress();
    }
  };

  const progress = Math.min(1, Math.abs(offsetX) / REPLY_THRESHOLD_PX);
  const hintSide = side === 'left' ? 'left' : 'right';

  return (
    <div className={`chat-swipe-reply relative max-w-full ${className}`}>
      <div
        className={`chat-swipe-reply-hint chat-swipe-reply-hint--${hintSide} ${progress > 0.15 ? 'is-visible' : ''}`}
        style={{ opacity: progress }}
        aria-hidden
      >
        <Reply className="h-4 w-4" />
      </div>
      <div
        className={`chat-swipe-reply-body ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: offsetX ? `translateX(${offsetX}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onContextMenu={onContextMenu}
      >
        {children}
      </div>
    </div>
  );
}
