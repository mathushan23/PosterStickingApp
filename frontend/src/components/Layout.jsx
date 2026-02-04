import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout({ children, role = "user" }) {
  const { user, logout } = useAuth?.() || {};
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = role === "admin" || user?.role === "admin";

  const adminNav = [
    { icon: "📊", label: "Dashboard", path: "/admin/dashboard" },
    { icon: "👥", label: "Users", path: "/admin/users" },
    { icon: "📋", label: "Submissions", path: "/admin/submissions" },
    { icon: "📍", label: "Spots", path: "/admin/spots" },
    { icon: "🧾", label: "Assignments", path: "/admin/assignments" },
    { icon: "📜", label: "Assignment History", path: "/admin/assignment-history" },
  ];

  const userNav = [
    { icon: "🏠", label: "Dashboard", path: "/user/dashboard" },
    { icon: "📤", label: "Submit Proof", path: "/user/submit" },
    { icon: "🗺️", label: "Assigned Tasks", path: "/user/assignments" },
    { icon: "📜", label: "My History", path: "/user/history" },
  ];

  const navItems = isAdmin ? adminNav : userNav;

  function handleLogout() {
    try {
      logout?.();
    } catch { }
    navigate("/login");
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-layout">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle menu"
      >
        {isSidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <Link
            to={isAdmin ? "/admin/dashboard" : "/user/dashboard"}
            className="sidebar-brand"
            onClick={() => setIsSidebarOpen(false)}
          >
            <div className="sidebar-brand-icon">📋</div>
            <span>Poster Proof</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              {isAdmin ? "Admin Panel" : "User Panel"}
            </div>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive(item.path) ? "active" : ""}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.email || "User"}</div>
              <div className="sidebar-user-role">{isAdmin ? "Admin" : "User"}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
