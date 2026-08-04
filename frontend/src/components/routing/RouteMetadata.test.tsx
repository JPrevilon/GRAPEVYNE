import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import RouteMetadata from "./RouteMetadata";

const PREVIEW_DESCRIPTION =
  "Discover wines for the meal, moment, or mood—and keep every bottle worth remembering in a private cellar.";

function metaContent(attribute: "name" | "property", key: string) {
  return document.head
    .querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    ?.getAttribute("content");
}

function renderMetadata(pathname: string) {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[pathname]}
    >
      <RouteMetadata />
    </MemoryRouter>,
  );
}

describe("RouteMetadata", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>GRAPEVYNE — From Vine to Memory</title>
      <meta name="description" content="${PREVIEW_DESCRIPTION}" />
      <meta name="robots" content="noindex,nofollow" />
      <meta name="googlebot" content="noindex,nofollow" />
      <meta property="og:title" content="GRAPEVYNE — From Vine to Memory" />
      <meta property="og:description" content="${PREVIEW_DESCRIPTION}" />
      <meta name="twitter:title" content="GRAPEVYNE — From Vine to Memory" />
      <meta name="twitter:description" content="${PREVIEW_DESCRIPTION}" />
    `;
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    [
      "/",
      "GRAPEVYNE — From Vine to Memory",
      PREVIEW_DESCRIPTION,
    ],
    [
      "/discover",
      "Discover Wines | GRAPEVYNE",
      "Search the demonstration wine catalog with natural-language clues and explainable matching.",
    ],
    [
      "/demo/cellar",
      "Demo Cellar | GRAPEVYNE",
      "Explore a public, read-only demonstration of the GRAPEVYNE visual cellar.",
    ],
    [
      "/demo/taste-atlas",
      "Demo Taste Atlas | GRAPEVYNE",
      "Explore a public, read-only demonstration of the GRAPEVYNE Taste Atlas.",
    ],
    [
      "/wines/mock-chateau-montelena-cabernet-sauvignon-2019",
      "Wine Detail | GRAPEVYNE",
      "Review source-backed wine details, tasting signals, pairings, and the explanation behind a match.",
    ],
    [
      "/cellar",
      "Private Cellar | GRAPEVYNE",
      "Organize private saved wines and record personal tasting memories in an owner-scoped cellar.",
    ],
    [
      "/profile",
      "Taste Profile | GRAPEVYNE",
      "Explore a private, explainable Taste Profile and its accessible Taste Atlas.",
    ],
    [
      "/login",
      "Login | GRAPEVYNE",
      "Sign in to return to a private GRAPEVYNE cellar and Taste Profile.",
    ],
    [
      "/signup",
      "Signup | GRAPEVYNE",
      "Create a GRAPEVYNE account for a private cellar and personal tasting memories.",
    ],
  ])("sets truthful metadata for %s", async (pathname, title, description) => {
    renderMetadata(pathname);

    await waitFor(() => expect(document.title).toBe(title));
    expect(metaContent("name", "description")).toBe(description);
    expect(metaContent("property", "og:title")).toBe(title);
    expect(metaContent("property", "og:description")).toBe(description);
    expect(metaContent("name", "twitter:title")).toBe(title);
    expect(metaContent("name", "twitter:description")).toBe(description);
    expect(metaContent("name", "robots")).toBe("noindex,nofollow");
    expect(metaContent("name", "googlebot")).toBe("noindex,nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(metaContent("property", "og:url")).toBeUndefined();
  });

  it("forces deliberate not-found metadata without inventing a canonical URL", async () => {
    document.head
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "index,follow");
    document.head
      .querySelector('meta[name="googlebot"]')
      ?.setAttribute("content", "index,follow");

    const view = renderMetadata("/an-intentional-404");

    await waitFor(() =>
      expect(document.title).toBe("Page Not Found | GRAPEVYNE"),
    );
    expect(metaContent("name", "description")).toBe(
      "The requested address is not part of the GRAPEVYNE directory. No account or saved-wine data has been changed.",
    );
    expect(metaContent("name", "robots")).toBe("noindex,nofollow");
    expect(metaContent("name", "googlebot")).toBe("noindex,nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(metaContent("property", "og:url")).toBeUndefined();

    view.unmount();
    expect(metaContent("name", "robots")).toBe("index,follow");
    expect(metaContent("name", "googlebot")).toBe("index,follow");
  });
});
