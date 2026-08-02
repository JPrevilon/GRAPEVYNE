import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }),
  writable: true,
});

Object.defineProperty(window, "requestAnimationFrame", {
  configurable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(callback, 0),
  writable: true,
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
  writable: true,
});

Object.defineProperties(HTMLMediaElement.prototype, {
  load: {
    configurable: true,
    value: () => undefined,
    writable: true,
  },
  pause: {
    configurable: true,
    value: () => undefined,
    writable: true,
  },
  play: {
    configurable: true,
    value: () => Promise.resolve(),
    writable: true,
  },
});

class ResizeObserverStub implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
  writable: true,
});

Object.defineProperty(window, "IntersectionObserver", {
  configurable: true,
  value: IntersectionObserverStub,
  writable: true,
});
