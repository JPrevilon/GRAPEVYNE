export interface ReturnLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

interface ReturnState {
  from?: ReturnLocation | string | null;
}

export function isSafeInternalReturnTo(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("\r") &&
    !value.includes("\n")
  );
}

function locationToPath(location: ReturnLocation): string {
  return `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`;
}

export function getReturnTo(
  state: unknown,
  fallback = "/cellar"
): string {
  const safeFallback = isSafeInternalReturnTo(fallback) ? fallback : "/cellar";

  if (typeof state !== "object" || state === null || !("from" in state)) {
    return safeFallback;
  }

  const { from } = state as ReturnState;
  const destination =
    typeof from === "string"
      ? from
      : from && typeof from.pathname === "string"
        ? locationToPath(from)
        : "";

  return isSafeInternalReturnTo(destination) ? destination : safeFallback;
}
