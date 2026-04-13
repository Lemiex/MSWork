import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-brand">MS WORK</span>
          <div className="navbar-links">
            {user?.role === "regular" && (
              <>
                <NavLink className="navbar-link" to="/jobs">
                  Browse Jobs
                </NavLink>
                <NavLink className="navbar-link" to="/my-interests">
                  My Interests
                </NavLink>
                <NavLink className="navbar-link" to="/invitations">
                  Invitations
                </NavLink>
                <NavLink className="navbar-link" to="/qualifications">
                  Qualifications
                </NavLink>
                <NavLink className="navbar-link" to="/negotiation">
                  Negotiation
                </NavLink>
                <NavLink className="navbar-link" to="/profile">
                  Profile
                </NavLink>
              </>
            )}
            {user?.role === "business" && (
              <>
                <NavLink className="navbar-link" to="/business/jobs">
                  My Jobs
                </NavLink>
                <NavLink className="navbar-link" to="/negotiation">
                  Negotiation
                </NavLink>
                <NavLink className="navbar-link" to="/business/profile">
                  Profile
                </NavLink>
              </>
            )}
            {user?.role === "admin" && (
              <>
                <NavLink className="navbar-link" to="/admin" end>
                  Dashboard
                </NavLink>
                <NavLink className="navbar-link" to="/admin/users">
                  Users
                </NavLink>
                <NavLink className="navbar-link" to="/admin/businesses">
                  Businesses
                </NavLink>
                <NavLink className="navbar-link" to="/admin/qualifications">
                  Qualifications
                </NavLink>
                <NavLink className="navbar-link" to="/admin/position-types">
                  Position Types
                </NavLink>
                <NavLink className="navbar-link" to="/admin/system">
                  System
                </NavLink>
              </>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm navbar-logout"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </>
  );
}
