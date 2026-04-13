import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Sarah's
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import PublicBusinesses from "./pages/PublicBusinesses";
import PublicBusinessProfile from "./pages/PublicBusinessProfile";
import Login from "./pages/Login";
import RegisterChoice from "./pages/RegisterChoice";
import Register from "./pages/Register";
import Reset from "./pages/Reset";
import ResetToken from "./pages/ResetToken";
import Layout from "./components/Layout";
import Profile from "./pages/Profile";
import Qualifications from "./pages/Qualifications";
import BrowseJobs from "./pages/BrowseJobs";
import JobDetail from "./pages/JobDetail";
import MyInterests from "./pages/MyInterests";
import Invitations from "./pages/Invitations";
import Negotiation from "./pages/Negotiation";
import NegotiationDetail from "./pages/NegotiationDetail";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";

// ── business pages ────────────────────────────
import RegisterBusiness from "./pages/RegisterBusiness";
import BusinessProfile from "./pages/BusinessProfile";
import BusinessJobs from "./pages/BusinessJobs";
import BusinessJobForm from "./pages/BusinessJobForm";
import BusinessCandidates from "./pages/BusinessCandidates";
import BusinessCandidateDetail from "./pages/BusinessCandidateDetail";

import AdminQualifications from "./pages/AdminQualifications";
import AdminQualificationDetail from "./pages/AdminQualificationDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminBusinesses from "./pages/AdminBusinesses";
import AdminPositionTypes from "./pages/AdminPositionTypes";
import AdminSystem from "./pages/AdminSystem";

// ── Role-based redirect from "/" ──────────────────────────────────────────────
function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Landing />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "business")
    return <Navigate to="/business/profile" replace />;
  return <Navigate to="/jobs" replace />;
}

// ── Route guard for authenticated pages ───────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Route guard for role-restricted pages ─────────────────────────────────────
function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Unauthorized />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/businesses" element={<PublicBusinesses />} />
          <Route path="/businesses/:id" element={<PublicBusinessProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterChoice />} />
          <Route path="/register/user" element={<Register />} />
          <Route path="/register/business" element={<RegisterBusiness />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/reset/:token" element={<ResetToken />} />
          {/* Protected routes — all share Layout */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            {/* Regular user */}
            <Route path="/profile" element={<RequireRole roles={["regular"]}><Profile /></RequireRole>} />
            <Route path="/qualifications" element={<RequireRole roles={["regular"]}><Qualifications /></RequireRole>} />
            <Route path="/jobs" element={<RequireRole roles={["regular"]}><BrowseJobs /></RequireRole>} />
            <Route path="/jobs/:id" element={<RequireRole roles={["regular"]}><JobDetail /></RequireRole>} />
            <Route path="/my-interests" element={<RequireRole roles={["regular"]}><MyInterests /></RequireRole>} />
            <Route path="/invitations" element={<RequireRole roles={["regular"]}><Invitations /></RequireRole>} />
            <Route path="/negotiation" element={<RequireRole roles={["regular", "business"]}><Negotiation /></RequireRole>} />
            <Route path="/negotiation/:id" element={<RequireRole roles={["regular", "business"]}><NegotiationDetail /></RequireRole>} />

            {/* Business  */}
            <Route path="/business/profile" element={<RequireRole roles={["business"]}><BusinessProfile /></RequireRole>} />
            <Route path="/business/jobs" element={<RequireRole roles={["business"]}><BusinessJobs /></RequireRole>} />
            <Route path="/business/jobs/new" element={<RequireRole roles={["business"]}><BusinessJobForm /></RequireRole>} />
            <Route
              path="/business/jobs/:id/edit"
              element={<RequireRole roles={["business"]}><BusinessJobForm /></RequireRole>}
            />
            <Route
              path="/business/jobs/:id/candidates"
              element={<RequireRole roles={["business"]}><BusinessCandidates /></RequireRole>}
            />
            <Route
              path="/business/jobs/:id/candidates/:userId"
              element={<RequireRole roles={["business"]}><BusinessCandidateDetail /></RequireRole>}
            />

            {/* Admin  */}
            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminDashboard /></RequireRole>} />
            <Route path="/admin/users" element={<RequireRole roles={["admin"]}><AdminUsers /></RequireRole>} />
            <Route path="/admin/businesses" element={<RequireRole roles={["admin"]}><AdminBusinesses /></RequireRole>} />
            <Route
              path="/admin/qualifications"
              element={<RequireRole roles={["admin"]}><AdminQualifications /></RequireRole>}
            />
            <Route
              path="/admin/qualifications/:id"
              element={<RequireRole roles={["admin"]}><AdminQualificationDetail /></RequireRole>}
            />
            <Route
              path="/admin/position-types"
              element={<RequireRole roles={["admin"]}><AdminPositionTypes /></RequireRole>}
            />
            <Route path="/admin/system" element={<RequireRole roles={["admin"]}><AdminSystem /></RequireRole>} />
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
