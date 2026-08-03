const REACT_CAUGHT_ERROR_PATTERNS = [
  /Error: Uncaught \[/,
  /The above error occurred in the </,
  /React will try to recreate this component tree/,
];

let restoreInstalledConsole: (() => void) | null = null;

/**
 * React 18's development build writes a caught render error to the console
 * before an error boundary can replace it with a safe summary. Those raw
 * messages may contain route data, so redact only React's caught-error frames
 * while preserving unrelated developer diagnostics.
 */
export function installSafeDevelopmentConsole(): () => void {
  if (restoreInstalledConsole) return restoreInstalledConsole;

  const originalConsoleError = console.error;
  const safeConsoleError = (...arguments_: unknown[]) => {
    const isReactCaughtError = arguments_.some(
      (argument) =>
        typeof argument === "string" &&
        REACT_CAUGHT_ERROR_PATTERNS.some((pattern) => pattern.test(argument)),
    );

    if (isReactCaughtError) {
      originalConsoleError.call(
        console,
        "[GRAPEVYNE] React caught a render failure; raw error details were withheld.",
      );
      return;
    }

    originalConsoleError.apply(console, arguments_);
  };

  console.error = safeConsoleError;
  restoreInstalledConsole = () => {
    if (console.error === safeConsoleError) console.error = originalConsoleError;
    restoreInstalledConsole = null;
  };
  return restoreInstalledConsole;
}
