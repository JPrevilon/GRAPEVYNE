import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Search, UserRound, Wine } from "lucide-react";

import { useToast } from "../ui/useToast.js";
import { useAuth } from "../../features/auth/useAuth.js";

export default function Header() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const navItems = isAuthenticated
    ? [
        { to: "/discover", label: "Discover" },
        { to: "/cellar", label: "Cellar" },
        { to: "/profile", label: "Profile" },
      ]
    : [{ to: "/discover", label: "Discover" }];

  async function handleLogout() {
    try {
      await logout();
      showToast({
        title: "Signed out",
        message: "Your private cellar is closed.",
      });
      navigate("/");
    } catch (error) {
      showToast({
        title: "Logout failed",
        message: error.message || "Could not sign out cleanly.",
        tone: "error",
      });
    }
  }

  return (
    <header className="site-header">
      <NavLink to="/" className="brand-mark" aria-label="GrapeVyne home">
        <span className="brand-icon">
          <Wine size={20} strokeWidth={1.8} />
        </span>
        <span>GrapeVyne</span>
      </NavLink>

      <nav className="primary-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <NavLink to="/discover" className="icon-button" aria-label="Search wines">
          <Search size={18} />
        </NavLink>
        {isLoading ? (
          <span className="header-status">Checking session</span>
        ) : isAuthenticated ? (
          <>
            <span className="header-user" title={user?.email}>
              {user?.name}
            </span>
            <button className="text-button" type="button" onClick={handleLogout}>
              <LogOut size={17} />
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="text-button">
              <UserRound size={17} />
              Login
            </NavLink>
            <NavLink to="/signup" className="primary-button">
              Signup
            </NavLink>
          </>
        )}
      </div>
    </header>
  );
}
