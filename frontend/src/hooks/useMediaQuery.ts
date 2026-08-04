import { useCallback, useSyncExternalStore } from "react";

interface MediaQueryStore {
  detach?: () => void;
  listeners: Set<() => void>;
  mediaQuery?: MediaQueryList;
  snapshot: boolean;
}

const mediaQueryStores = new Map<string, MediaQueryStore>();

function getStore(query: string): MediaQueryStore {
  const existingStore = mediaQueryStores.get(query);

  if (existingStore) {
    return existingStore;
  }

  const store: MediaQueryStore = {
    listeners: new Set(),
    snapshot: false,
  };
  mediaQueryStores.set(query, store);

  return store;
}

function getMediaQuery(query: string, store: MediaQueryStore) {
  if (
    store.mediaQuery === undefined &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    store.mediaQuery = window.matchMedia(query);
    store.snapshot = store.mediaQuery.matches;
  }

  return store.mediaQuery;
}

function subscribeToMediaQuery(query: string, listener: () => void) {
  const store = getStore(query);
  const mediaQuery = getMediaQuery(query, store);
  store.listeners.add(listener);

  if (mediaQuery && store.detach === undefined) {
    store.snapshot = mediaQuery.matches;
    const notifyListeners = (event: MediaQueryListEvent) => {
      store.snapshot = event.matches;
      store.listeners.forEach((notify) => notify());
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", notifyListeners);
      store.detach = () =>
        mediaQuery.removeEventListener("change", notifyListeners);
    } else {
      mediaQuery.addListener(notifyListeners);
      store.detach = () => mediaQuery.removeListener(notifyListeners);
    }
  }

  return () => {
    store.listeners.delete(listener);

    if (store.listeners.size === 0) {
      store.detach?.();
      store.detach = undefined;
      store.mediaQuery = undefined;
      store.snapshot = false;
      mediaQueryStores.delete(query);
    }
  };
}

function getMediaQuerySnapshot(query: string) {
  const store = getStore(query);
  getMediaQuery(query, store);

  return store.snapshot;
}

const getServerSnapshot = () => false;

/**
 * Subscribes React to a media query without creating one global listener per
 * component instance. The synchronous browser snapshot prevents a reduced-
 * motion visitor from briefly mounting motion-heavy content during startup.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToMediaQuery(query, listener),
    [query],
  );
  const getSnapshot = useCallback(
    () => getMediaQuerySnapshot(query),
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
