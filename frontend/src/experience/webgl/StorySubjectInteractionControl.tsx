import {
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";

import {
  type InteractiveStorySubject,
  type SubjectInteractionState,
  type SubjectRotationKey,
  applySubjectDragDelta,
  applySubjectKeyIncrement,
  resetSubjectInteraction,
  setSubjectDragging,
} from "./subjectInteraction";

export interface StorySubjectInteractionControlProps {
  disabled?: boolean;
  interactionRef: MutableRefObject<SubjectInteractionState>;
  onActivityChange?: (active: boolean) => void;
  regionStyle?: CSSProperties;
  subject: InteractiveStorySubject;
}

interface PointerSession {
  activated: boolean;
  lastX: number;
  lastY: number;
  node: HTMLButtonElement | null;
  pointerId: number | null;
  pointerType: string;
  startX: number;
  startY: number;
}

const TOUCH_HOLD_MILLISECONDS = 160;
const TOUCH_MOVEMENT_CANCEL_PIXELS = 10;

const SUBJECT_LABELS = {
  bottle: "Rotate the GRAPEVYNE wine bottle",
  grapes: "Rotate the GRAPEVYNE grape cluster",
} as const satisfies Record<InteractiveStorySubject, string>;

const INITIAL_POINTER_SESSION: PointerSession = {
  activated: false,
  lastX: 0,
  lastY: 0,
  node: null,
  pointerId: null,
  pointerType: "",
  startX: 0,
  startY: 0,
};

function formatRotation(value: number) {
  if (Math.abs(value) < 0.0000005) return "0";
  return value.toFixed(6);
}

export default function StorySubjectInteractionControl({
  disabled = false,
  interactionRef,
  onActivityChange,
  regionStyle,
  subject,
}: StorySubjectInteractionControlProps) {
  const descriptionId = `${useId()}-story-subject-rotation-instructions`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const disabledRef = useRef(disabled);
  const activityCallbackRef = useRef(onActivityChange);
  const activityNotifiedRef = useRef(false);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const touchMoveListenerInstalledRef = useRef(false);
  const pointerSessionRef = useRef<PointerSession>({
    ...INITIAL_POINTER_SESSION,
  });
  const previousInlineStylesRef = useRef({ cursor: "", touchAction: "" });

  disabledRef.current = disabled;
  activityCallbackRef.current = onActivityChange;

  const syncInstrumentation = useCallback(() => {
    const node = buttonRef.current;
    if (!node) return;
    const interaction = interactionRef.current[subject];

    node.dataset.dragging = String(interaction.dragging);
    node.dataset.targetPitch = formatRotation(interaction.targetPitch);
    node.dataset.targetYaw = formatRotation(interaction.targetYaw);
    node.dataset.userModified = String(interaction.userModified);
  }, [interactionRef, subject]);

  const notifyActivity = useCallback((active: boolean) => {
    if (activityNotifiedRef.current === active) return;
    activityNotifiedRef.current = active;
    activityCallbackRef.current?.(active);
  }, []);

  const preventActiveTouchMove = useCallback((event: TouchEvent) => {
    const session = pointerSessionRef.current;
    if (session.activated && session.pointerType === "touch") {
      event.preventDefault();
    }
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current === undefined) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = undefined;
  }, []);

  const removeTouchMoveListener = useCallback(() => {
    if (!touchMoveListenerInstalledRef.current) return;
    document.removeEventListener("touchmove", preventActiveTouchMove);
    touchMoveListenerInstalledRef.current = false;
  }, [preventActiveTouchMove]);

  const finishPointerSession = useCallback(
    (releaseCapture = true) => {
      clearHoldTimer();
      removeTouchMoveListener();

      const session = pointerSessionRef.current;
      const node = session.node;
      const pointerId = session.pointerId;

      if (session.activated) {
        interactionRef.current[subject] = setSubjectDragging(
          interactionRef.current[subject],
          false,
        );
        notifyActivity(false);
      }

      if (node && session.activated) {
        node.style.cursor = disabledRef.current
          ? "default"
          : previousInlineStylesRef.current.cursor;
        node.style.touchAction = previousInlineStylesRef.current.touchAction;

        if (releaseCapture && pointerId !== null) {
          try {
            if (
              !node.hasPointerCapture ||
              node.hasPointerCapture(pointerId)
            ) {
              node.releasePointerCapture?.(pointerId);
            }
          } catch {
            // Pointer capture may already have been released by the browser.
          }
        }
      }

      pointerSessionRef.current = { ...INITIAL_POINTER_SESSION };
      syncInstrumentation();
    },
    [
      clearHoldTimer,
      interactionRef,
      notifyActivity,
      removeTouchMoveListener,
      subject,
      syncInstrumentation,
    ],
  );

  const activatePointerSession = useCallback(
    (node: HTMLButtonElement, pointerId: number) => {
      const session = pointerSessionRef.current;
      if (
        disabledRef.current ||
        session.pointerId !== pointerId ||
        session.activated
      ) {
        return;
      }

      clearHoldTimer();
      session.activated = true;
      previousInlineStylesRef.current = {
        cursor: node.style.cursor,
        touchAction: node.style.touchAction,
      };
      node.style.cursor = "grabbing";

      if (session.pointerType === "touch") {
        node.style.touchAction = "none";
        if (!touchMoveListenerInstalledRef.current) {
          document.addEventListener("touchmove", preventActiveTouchMove, {
            passive: false,
          });
          touchMoveListenerInstalledRef.current = true;
        }
      }

      try {
        node.setPointerCapture?.(pointerId);
      } catch {
        // A disappearing or browser-owned pointer cannot be captured.
      }

      interactionRef.current[subject] = setSubjectDragging(
        interactionRef.current[subject],
        true,
      );
      syncInstrumentation();
      notifyActivity(true);
    },
    [
      clearHoldTimer,
      interactionRef,
      notifyActivity,
      preventActiveTouchMove,
      subject,
      syncInstrumentation,
    ],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (
        disabledRef.current ||
        event.isPrimary === false ||
        (event.pointerType !== "touch" && event.button !== 0)
      ) {
        return;
      }

      finishPointerSession();
      const node = event.currentTarget;
      const pointerType = event.pointerType || "mouse";
      pointerSessionRef.current = {
        activated: false,
        lastX: event.clientX,
        lastY: event.clientY,
        node,
        pointerId: event.pointerId,
        pointerType,
        startX: event.clientX,
        startY: event.clientY,
      };
      node.focus();

      if (pointerType === "touch") {
        holdTimerRef.current = window.setTimeout(() => {
          activatePointerSession(node, event.pointerId);
        }, TOUCH_HOLD_MILLISECONDS);
        return;
      }

      event.preventDefault();
      activatePointerSession(node, event.pointerId);
    },
    [activatePointerSession, finishPointerSession],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = pointerSessionRef.current;
      if (session.pointerId !== event.pointerId) return;

      if (!session.activated) {
        if (
          session.pointerType === "touch" &&
          Math.hypot(
            event.clientX - session.startX,
            event.clientY - session.startY,
          ) > TOUCH_MOVEMENT_CANCEL_PIXELS
        ) {
          finishPointerSession();
        }
        return;
      }

      event.preventDefault();
      interactionRef.current[subject] = applySubjectDragDelta(
        interactionRef.current[subject],
        subject,
        event.clientX - session.lastX,
        event.clientY - session.lastY,
      );
      session.lastX = event.clientX;
      session.lastY = event.clientY;
      syncInstrumentation();
    },
    [finishPointerSession, interactionRef, subject, syncInstrumentation],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = pointerSessionRef.current;
      if (session.pointerId !== event.pointerId) return;
      if (session.activated) event.preventDefault();
      finishPointerSession();
    },
    [finishPointerSession],
  );

  const handleLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pointerSessionRef.current.pointerId !== event.pointerId) return;
      finishPointerSession(false);
    },
    [finishPointerSession],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabledRef.current) return;

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        interactionRef.current[subject] = applySubjectKeyIncrement(
          interactionRef.current[subject],
          subject,
          event.key as SubjectRotationKey,
        );
        syncInstrumentation();
        return;
      }

      if (event.key === "Home" || event.key.toLowerCase() === "r") {
        event.preventDefault();
        finishPointerSession();
        interactionRef.current[subject] = resetSubjectInteraction(
          interactionRef.current[subject],
        );
        syncInstrumentation();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finishPointerSession();
        event.currentTarget.blur();
      }
    },
    [finishPointerSession, interactionRef, subject, syncInstrumentation],
  );

  useEffect(() => {
    syncInstrumentation();
  }, [syncInstrumentation]);

  useEffect(() => {
    const control = interactionRef.current.control;
    const element = buttonRef.current;
    control.cancel = finishPointerSession;
    control.element = element;
    control.subject = subject;

    return () => {
      finishPointerSession();
      if (control.element === element) {
        control.cancel = null;
        control.element = null;
        control.subject = null;
      }
    };
  }, [finishPointerSession, interactionRef, subject]);

  useEffect(() => {
    if (disabled) finishPointerSession();
  }, [disabled, finishPointerSession]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") finishPointerSession();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      finishPointerSession();
    };
  }, [finishPointerSession]);

  const interaction = interactionRef.current[subject];

  return (
    <>
      <button
        aria-describedby={descriptionId}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home R Escape"
        aria-label={SUBJECT_LABELS[subject]}
        className={`gv-story-subject-control gv-story-subject-control--${subject}`}
        data-dragging={String(interaction.dragging)}
        data-interaction-subject={subject}
        data-story-subject-control="true"
        data-target-pitch={formatRotation(interaction.targetPitch)}
        data-target-yaw={formatRotation(interaction.targetYaw)}
        data-user-modified={String(interaction.userModified)}
        disabled={disabled}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        ref={buttonRef}
        style={{
          ...regionStyle,
          cursor: disabled ? "default" : "grab",
          touchAction: "pan-y",
        }}
        type="button"
      >
        <span aria-hidden="true" className="gv-story-subject-control__affordance">
          ROTATE
        </span>
      </button>
      <span className="gv-visually-hidden" id={descriptionId}>
        Drag to rotate. Use arrow keys to rotate, Home or R to reset, and Escape
        to cancel.
      </span>
    </>
  );
}
