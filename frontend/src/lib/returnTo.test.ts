import { describe, expect, it } from "vitest";

import { getReturnTo, isSafeInternalReturnTo } from "./returnTo";

describe("return destinations", () => {
  it("preserves the full pathname, search, and hash", () => {
    expect(
      getReturnTo({
        from: {
          hash: "#bottles",
          pathname: "/cellar",
          search: "?sort=rating",
        },
      })
    ).toBe("/cellar?sort=rating#bottles");
    expect(getReturnTo({ from: "/profile?tab=taste#atlas" })).toBe(
      "/profile?tab=taste#atlas"
    );
  });

  it.each([
    "//outside.example/path",
    "https://outside.example/path",
    "/\\outside.example/path",
    "cellar",
  ])("rejects unsafe destination %s", (destination) => {
    expect(isSafeInternalReturnTo(destination)).toBe(false);
    expect(getReturnTo({ from: destination })).toBe("/cellar");
  });
});
