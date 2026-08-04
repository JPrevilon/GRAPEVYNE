import type { TestInfo } from "@playwright/test";

export interface DisposableAccount {
  email: string;
  name: string;
  password: string;
}

function safeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function disposableAccount(
  label: string,
  testInfo: TestInfo,
): DisposableAccount {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const uniquePart = [
    Date.now(),
    process.pid,
    testInfo.workerIndex,
    testInfo.repeatEachIndex,
    randomPart,
  ].join("-");

  return {
    email: `e2e-${safeLabel(label)}-${uniquePart}@example.test`,
    name: `E2E ${label}`,
    password: "Prompt09!private-cellar",
  };
}
