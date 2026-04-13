import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/admin/users", label: "Users", description: "Search, filter, and suspend regular user accounts." },
  { to: "/admin/businesses", label: "Businesses", description: "Search, filter, and verify business accounts." },
  { to: "/admin/qualifications", label: "Qualifications", description: "Review and approve or reject submitted qualifications." },
  { to: "/admin/position-types", label: "Position Types", description: "Create, edit, hide, and delete position types." },
  { to: "/admin/system", label: "System Config", description: "Adjust cooldowns, timeouts, and negotiation windows." },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>

      <div style={{ display: "grid", gap: 12 }}>
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} className="item-card" style={{ textDecoration: "none" }}>
            <div className="item-card-main">
              <span className="item-card-title">{link.label}</span>
              <div className="item-card-sub">{link.description}</div>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: 18, alignSelf: "center" }}>›</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
