import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageMetadata {
  description: string;
  title: string;
}

interface ResolvedPageMetadata extends PageMetadata {
  notFound: boolean;
}

const EXACT_METADATA: Record<string, PageMetadata> = {
  "/": {
    description:
      "Discover wines for the meal, moment, or mood—and keep every bottle worth remembering in a private cellar.",
    title: "GRAPEVYNE — From Vine to Memory",
  },
  "/cellar": {
    description:
      "Organize private saved wines and record personal tasting memories in an owner-scoped cellar.",
    title: "Private Cellar | GRAPEVYNE",
  },
  "/demo/cellar": {
    description:
      "Explore a public, read-only demonstration of the GRAPEVYNE visual cellar.",
    title: "Demo Cellar | GRAPEVYNE",
  },
  "/demo/taste-atlas": {
    description:
      "Explore a public, read-only demonstration of the GRAPEVYNE Taste Atlas.",
    title: "Demo Taste Atlas | GRAPEVYNE",
  },
  "/discover": {
    description:
      "Search the demonstration wine catalog with natural-language clues and explainable matching.",
    title: "Discover Wines | GRAPEVYNE",
  },
  "/login": {
    description:
      "Sign in to return to a private GRAPEVYNE cellar and Taste Profile.",
    title: "Login | GRAPEVYNE",
  },
  "/profile": {
    description:
      "Explore a private, explainable Taste Profile and its accessible Taste Atlas.",
    title: "Taste Profile | GRAPEVYNE",
  },
  "/signup": {
    description:
      "Create a GRAPEVYNE account for a private cellar and personal tasting memories.",
    title: "Signup | GRAPEVYNE",
  },
};

const WINE_DETAIL_METADATA: PageMetadata = {
  description:
    "Review source-backed wine details, tasting signals, pairings, and the explanation behind a match.",
  title: "Wine Detail | GRAPEVYNE",
};

const NOT_FOUND_METADATA: PageMetadata = {
  description:
    "The requested address is not part of the GRAPEVYNE directory. No account or saved-wine data has been changed.",
  title: "Page Not Found | GRAPEVYNE",
};

function metadataForPath(pathname: string): ResolvedPageMetadata {
  const exact = EXACT_METADATA[pathname];

  if (exact) return { ...exact, notFound: false };
  if (pathname.startsWith("/wines/")) {
    return { ...WINE_DETAIL_METADATA, notFound: false };
  }

  return { ...NOT_FOUND_METADATA, notFound: true };
}

function setMetaContent(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  const created = element === null;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }

  const previousContent = element.getAttribute("content");
  element.setAttribute("content", content);

  return () => {
    if (created) {
      element.remove();
    } else if (previousContent === null) {
      element.removeAttribute("content");
    } else {
      element.setAttribute("content", previousContent);
    }
  };
}

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = metadataForPath(pathname);
    const previousTitle = document.title;
    const restoreMeta = [
      setMetaContent("name", "description", metadata.description),
      setMetaContent("property", "og:title", metadata.title),
      setMetaContent("property", "og:description", metadata.description),
      setMetaContent("name", "twitter:title", metadata.title),
      setMetaContent("name", "twitter:description", metadata.description),
    ];

    if (metadata.notFound) {
      restoreMeta.push(
        setMetaContent("name", "robots", "noindex,nofollow"),
        setMetaContent("name", "googlebot", "noindex,nofollow"),
      );
    }

    document.title = metadata.title;

    return () => {
      document.title = previousTitle;
      restoreMeta.reverse().forEach((restore) => restore());
    };
  }, [pathname]);

  return null;
}
