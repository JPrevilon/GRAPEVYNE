import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef, type MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StorySubjectInteractionControl from "./StorySubjectInteractionControl";
import {
  SUBJECT_KEYBOARD_YAW_INCREMENT,
  createSubjectInteractionState,
  type SubjectInteractionState,
} from "./subjectInteraction";

interface PointerCaptureHarness {
  captured: Set<number>;
  hasPointerCapture: ReturnType<typeof vi.fn>;
  releasePointerCapture: ReturnType<typeof vi.fn>;
  setPointerCapture: ReturnType<typeof vi.fn>;
}

function interactionRef(): MutableRefObject<SubjectInteractionState> {
  return { current: createSubjectInteractionState() };
}

function installPointerCapture(
  button: HTMLButtonElement,
): PointerCaptureHarness {
  const captured = new Set<number>();
  const setPointerCapture = vi.fn((pointerId: number) => {
    captured.add(pointerId);
  });
  const releasePointerCapture = vi.fn((pointerId: number) => {
    captured.delete(pointerId);
  });
  const hasPointerCapture = vi.fn((pointerId: number) =>
    captured.has(pointerId),
  );

  Object.defineProperties(button, {
    hasPointerCapture: { configurable: true, value: hasPointerCapture },
    releasePointerCapture: {
      configurable: true,
      value: releasePointerCapture,
    },
    setPointerCapture: { configurable: true, value: setPointerCapture },
  });

  return {
    captured,
    hasPointerCapture,
    releasePointerCapture,
    setPointerCapture,
  };
}

function pointerEvent(
  type: "pointerCancel" | "pointerDown" | "pointerMove" | "pointerUp",
  init: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId: number;
    pointerType: "mouse" | "pen" | "touch";
  },
) {
  const eventNames = {
    pointerCancel: "pointercancel",
    pointerDown: "pointerdown",
    pointerMove: "pointermove",
    pointerUp: "pointerup",
  } as const;
  const event = new Event(eventNames[type], {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    isPrimary: { value: true },
    pointerId: { value: init.pointerId },
    pointerType: { value: init.pointerType },
  });

  return fireEvent(screen.getByRole("button"), event);
}

function lostPointerCapture(pointerId: number) {
  const event = new Event("lostpointercapture", {
    bubbles: true,
    cancelable: false,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return fireEvent(screen.getByRole("button"), event);
}

describe("StorySubjectInteractionControl", () => {
  const originalVisibilityState = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState",
  );

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    if (originalVisibilityState) {
      Object.defineProperty(
        document,
        "visibilityState",
        originalVisibilityState,
      );
    }
  });

  it.each([
    ["bottle", "Rotate the GRAPEVYNE wine bottle"],
    ["grapes", "Rotate the GRAPEVYNE grape cluster"],
  ] as const)("renders one described semantic %s control", (subject, name) => {
    const ref = interactionRef();
    const { container, unmount } = render(
      <StorySubjectInteractionControl
        interactionRef={ref}
        subject={subject}
      />,
    );

    const button = screen.getByRole<HTMLButtonElement>("button", { name });
    const descriptionId = button.getAttribute("aria-describedby");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")).toHaveTextContent(
      /arrow keys.+Home or R.+Escape/i,
    );
    expect(button).toHaveAttribute("data-interaction-subject", subject);
    expect(button).toHaveAttribute("data-dragging", "false");
    expect(button).toHaveAttribute("data-target-yaw", "0");
    expect(button).toHaveAttribute("data-target-pitch", "0");
    expect(button).toHaveAttribute("data-user-modified", "false");
    expect(button).toHaveStyle({ cursor: "grab" });
    expect(button.style.touchAction).toBe("pan-y");
    expect(ref.current.control).toMatchObject({
      element: button,
      subject,
    });
    expect(ref.current.control.cancel).toBeTypeOf("function");

    unmount();
    expect(ref.current.control).toEqual({
      cancel: null,
      element: null,
      subject: null,
    });
  });

  it.each(["mouse", "pen"] as const)(
    "captures %s immediately, rotates through refs, and releases cleanly",
    (pointerType) => {
      const ref = interactionRef();
      const onActivityChange = vi.fn();
      render(
        <StorySubjectInteractionControl
          interactionRef={ref}
          onActivityChange={onActivityChange}
          subject="bottle"
        />,
      );
      const button = screen.getByRole<HTMLButtonElement>("button");
      const capture = installPointerCapture(button);

      pointerEvent("pointerDown", {
        clientX: 100,
        clientY: 100,
        pointerId: 7,
        pointerType,
      });
      expect(capture.setPointerCapture).toHaveBeenCalledWith(7);
      expect(ref.current.bottle.dragging).toBe(true);
      expect(button).toHaveAttribute("data-dragging", "true");
      expect(button.style.cursor).toBe("grabbing");
      expect(onActivityChange).toHaveBeenCalledWith(true);

      pointerEvent("pointerMove", {
        clientX: 340,
        clientY: 70,
        pointerId: 7,
        pointerType,
      });
      expect(ref.current.bottle.targetYaw).toBeGreaterThan(0);
      expect(ref.current.bottle.targetPitch).toBeGreaterThan(0);
      expect(ref.current.grapes.targetYaw).toBe(0);
      expect(button).toHaveAttribute("data-user-modified", "true");

      pointerEvent("pointerUp", {
        clientX: 340,
        clientY: 70,
        pointerId: 7,
        pointerType,
      });
      expect(capture.releasePointerCapture).toHaveBeenCalledWith(7);
      expect(ref.current.bottle.dragging).toBe(false);
      expect(ref.current.bottle.targetYaw).toBeGreaterThan(0);
      expect(button).toHaveAttribute("data-dragging", "false");
      expect(button.style.cursor).toBe("grab");
      expect(onActivityChange).toHaveBeenLastCalledWith(false);
    },
  );

  it("waits 160ms before capturing touch and prevents only the active drag", () => {
    vi.useFakeTimers();
    const ref = interactionRef();
    const onActivityChange = vi.fn();
    render(
      <StorySubjectInteractionControl
        interactionRef={ref}
        onActivityChange={onActivityChange}
        subject="grapes"
      />,
    );
    const button = screen.getByRole<HTMLButtonElement>("button");
    const capture = installPointerCapture(button);

    pointerEvent("pointerDown", {
      clientX: 40,
      clientY: 60,
      pointerId: 18,
      pointerType: "touch",
    });
    act(() => vi.advanceTimersByTime(159));
    expect(capture.setPointerCapture).not.toHaveBeenCalled();
    expect(ref.current.grapes.dragging).toBe(false);
    expect(onActivityChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(capture.setPointerCapture).toHaveBeenCalledWith(18);
    expect(ref.current.grapes.dragging).toBe(true);
    expect(button.style.touchAction).toBe("none");

    const touchMove = new Event("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);

    pointerEvent("pointerMove", {
      clientX: 100,
      clientY: 80,
      pointerId: 18,
      pointerType: "touch",
    });
    expect(ref.current.grapes.targetYaw).toBeGreaterThan(0);
    pointerEvent("pointerCancel", {
      pointerId: 18,
      pointerType: "touch",
    });
    expect(ref.current.grapes.dragging).toBe(false);
    expect(button.style.touchAction).toBe("pan-y");

    const releasedMove = new Event("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(releasedMove);
    expect(releasedMove.defaultPrevented).toBe(false);
  });

  it("cancels touch activation beyond ten pixels and preserves native motion", () => {
    vi.useFakeTimers();
    const ref = interactionRef();
    render(
      <StorySubjectInteractionControl
        interactionRef={ref}
        subject="bottle"
      />,
    );
    const button = screen.getByRole<HTMLButtonElement>("button");
    const capture = installPointerCapture(button);

    pointerEvent("pointerDown", {
      clientX: 20,
      clientY: 20,
      pointerId: 22,
      pointerType: "touch",
    });
    const nativeMotionPreserved = pointerEvent("pointerMove", {
      clientX: 20,
      clientY: 31,
      pointerId: 22,
      pointerType: "touch",
    });
    act(() => vi.advanceTimersByTime(500));

    expect(nativeMotionPreserved).toBe(true);
    expect(capture.setPointerCapture).not.toHaveBeenCalled();
    expect(ref.current.bottle.dragging).toBe(false);
    expect(ref.current.bottle.targetYaw).toBe(0);
    expect(button.style.touchAction).toBe("pan-y");
  });

  it("supports arrow rotation, Home and R reset, and Escape cancellation", () => {
    const ref = interactionRef();
    const onActivityChange = vi.fn();
    render(
      <StorySubjectInteractionControl
        interactionRef={ref}
        onActivityChange={onActivityChange}
        subject="bottle"
      />,
    );
    const button = screen.getByRole<HTMLButtonElement>("button");
    installPointerCapture(button);

    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(ref.current.bottle.targetYaw).toBeCloseTo(
      SUBJECT_KEYBOARD_YAW_INCREMENT,
    );
    expect(button).toHaveAttribute(
      "data-target-yaw",
      SUBJECT_KEYBOARD_YAW_INCREMENT.toFixed(6),
    );
    fireEvent.keyDown(button, { key: "Home" });
    expect(ref.current.bottle.targetYaw).toBe(0);
    expect(button).toHaveAttribute("data-target-yaw", "0");

    fireEvent.keyDown(button, { key: "ArrowLeft" });
    fireEvent.keyDown(button, { key: "r" });
    expect(ref.current.bottle.targetYaw).toBe(0);

    pointerEvent("pointerDown", {
      pointerId: 31,
      pointerType: "mouse",
    });
    expect(ref.current.bottle.dragging).toBe(true);
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(ref.current.bottle.dragging).toBe(false);
    expect(button).not.toHaveFocus();
    expect(onActivityChange).toHaveBeenLastCalledWith(false);
  });

  it("cleans capture on lost capture, visibility changes, disable, and unmount", () => {
    const ref = interactionRef();
    const onActivityChange = vi.fn();
    const forwardedRef = createRef<HTMLDivElement>();
    const view = render(
      <div ref={forwardedRef}>
        <StorySubjectInteractionControl
          interactionRef={ref}
          onActivityChange={onActivityChange}
          subject="bottle"
        />
      </div>,
    );
    const button = screen.getByRole<HTMLButtonElement>("button");
    const capture = installPointerCapture(button);

    pointerEvent("pointerDown", {
      pointerId: 42,
      pointerType: "mouse",
    });
    lostPointerCapture(42);
    expect(ref.current.bottle.dragging).toBe(false);

    pointerEvent("pointerDown", {
      pointerId: 43,
      pointerType: "mouse",
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(ref.current.bottle.dragging).toBe(false);
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(43);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    pointerEvent("pointerDown", {
      pointerId: 44,
      pointerType: "mouse",
    });
    view.rerender(
      <div ref={forwardedRef}>
        <StorySubjectInteractionControl
          disabled
          interactionRef={ref}
          onActivityChange={onActivityChange}
          subject="bottle"
        />
      </div>,
    );
    expect(ref.current.bottle.dragging).toBe(false);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button").style.cursor).toBe("default");
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(44);

    view.rerender(
      <div ref={forwardedRef}>
        <StorySubjectInteractionControl
          interactionRef={ref}
          onActivityChange={onActivityChange}
          subject="bottle"
        />
      </div>,
    );
    const enabledButton = screen.getByRole<HTMLButtonElement>("button");
    installPointerCapture(enabledButton);
    pointerEvent("pointerDown", {
      pointerId: 45,
      pointerType: "mouse",
    });
    view.unmount();
    expect(ref.current.bottle.dragging).toBe(false);
    expect(onActivityChange).toHaveBeenLastCalledWith(false);
  });
});
