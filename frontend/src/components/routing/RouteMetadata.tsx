import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const EXACT_TITLES: Record<string, string> = {
  "/": "From Vine to Memory",
  "/cellar": "Private Cellar",
  "/demo/cellar": "Demo Cellar",
  "/demo/taste-atlas": "Demo Taste Atlas",
  "/discover": "Discover Wines",
  "/login": "Login",
  "/profile": "Taste Profile",
  "/signup": "Signup",
};

function titleForPath(pathname: string) {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (pathname.startsWith("/wines/")) return "Wine Detail";
  return "Page Not Found";
}

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${titleForPath(pathname)} | GRAPEVYNE`;
    return () => {
      document.title = previousTitle;
    };
  }, [pathname]);

  return null;
}
