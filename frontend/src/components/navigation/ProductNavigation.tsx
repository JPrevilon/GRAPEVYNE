import { LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import BrandLockup from "@/components/brand/BrandLockup";
import { useToast } from "@/components/ui/useToast.js";
import { useAuth } from "@/features/auth/useAuth";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const authenticatedLinks = [
  { label: "Discover", number: "01", to: "/discover" },
  { label: "Cellar", number: "02", to: "/cellar" },
  { label: "Taste Profile", number: "03", to: "/profile" },
  { label: "Demo", number: "04", to: "/demo/cellar" },
] as const;

const anonymousLinks = [
  { label: "Discover", number: "01", to: "/discover" },
  { label: "Demo", number: "04", to: "/demo/cellar" },
] as const;

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export default function ProductNavigation() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerId = `${useId()}-navigation-drawer`;
  const drawerTitleId = `${drawerId}-title`;
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const navLinks = isAuthenticated ? authenticatedLinks : anonymousLinks;

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  function openDrawer() {
    returnFocusRef.current = menuButtonRef.current;
    setIsDrawerOpen(true);
  }

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(drawerRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement || !drawerRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement?.focus();
        return;
      }

      if (
        !event.shiftKey &&
        (activeElement === lastElement || !drawerRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus();
      }
    };
  }, [closeDrawer, isDrawerOpen]);

  async function handleLogout() {
    closeDrawer();

    try {
      await logout();
      showToast({
        message: "Your private cellar is closed.",
        title: "Signed out",
      });
      navigate("/");
    } catch (error) {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Could not sign out cleanly.",
        title: "Logout failed",
        tone: "error",
      });
    }
  }

  return (
    <header className={`gv-nav${isDrawerOpen ? " gv-nav--drawer-open" : ""}`}>
      <NavLink className="gv-nav__brand" to="/" aria-label="GRAPEVYNE home">
        <BrandLockup compact />
      </NavLink>

      <nav className="gv-nav__links" aria-label="Primary navigation">
        {navLinks.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `gv-nav__link${isActive ? " is-active" : ""}`
            }
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="gv-nav__actions">
        <NavLink className="gv-nav__search" to="/discover">
          <Search aria-hidden="true" size={18} />
          <span>Search</span>
        </NavLink>

        {isLoading ? (
          <span className="gv-nav__session-status" role="status">
            Checking session
          </span>
        ) : isAuthenticated ? (
          <>
            <span className="gv-nav__user" title={user?.email}>
              {user?.name}
            </span>
            <button
              className="gv-nav__logout"
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogOut aria-hidden="true" size={17} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <>
            <NavLink className="gv-nav__login" to="/login">
              <UserRound aria-hidden="true" size={17} />
              <span>Login</span>
            </NavLink>
            <NavLink className="gv-nav__signup" to="/signup">
              Signup
            </NavLink>
          </>
        )}

        <button
          aria-controls={drawerId}
          aria-expanded={isDrawerOpen}
          className="gv-nav__menu-trigger"
          onClick={openDrawer}
          ref={menuButtonRef}
          type="button"
        >
          <Menu aria-hidden="true" size={19} />
          <span>Menu</span>
        </button>
      </div>

      {isDrawerOpen ? (
        <div className="gv-nav__drawer-layer">
          <div className="gv-nav__drawer-backdrop" aria-hidden="true" />
          <div
            aria-labelledby={drawerTitleId}
            aria-modal="true"
            className="gv-nav__drawer"
            id={drawerId}
            ref={drawerRef}
            role="dialog"
          >
            <div className="gv-nav__drawer-header">
              <div>
                <BrandLockup compact />
                <h2 id={drawerTitleId}>Menu</h2>
              </div>
              <button
                className="gv-nav__drawer-close"
                onClick={closeDrawer}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={19} />
                <span>Close</span>
              </button>
            </div>

            <nav className="gv-nav__drawer-links" aria-label="Mobile navigation">
              {navLinks.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `gv-nav__drawer-link${isActive ? " is-active" : ""}`
                  }
                  key={item.to}
                  onClick={closeDrawer}
                  to={item.to}
                >
                  <span aria-hidden="true" className="gv-nav__drawer-number">
                    {item.number} /
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="gv-nav__drawer-account">
              <p className="gv-nav__drawer-account-label">05 / ACCOUNT</p>
              {isLoading ? (
                <span className="gv-nav__session-status" role="status">
                  Checking session
                </span>
              ) : isAuthenticated ? (
                <>
                  <div className="gv-nav__drawer-user">
                    <span>Signed in as</span>
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <button
                    className="gv-nav__drawer-logout"
                    onClick={() => void handleLogout()}
                    type="button"
                  >
                    <LogOut aria-hidden="true" size={17} />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    className="gv-nav__drawer-login"
                    onClick={closeDrawer}
                    to="/login"
                  >
                    <UserRound aria-hidden="true" size={17} />
                    <span>Login</span>
                  </NavLink>
                  <NavLink
                    className="gv-nav__drawer-signup"
                    onClick={closeDrawer}
                    to="/signup"
                  >
                    Signup
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
