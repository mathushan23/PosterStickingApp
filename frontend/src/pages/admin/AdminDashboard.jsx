import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [spots, setSpots] = useState([]);

  async function load() {
    setLoading(true);
    try {
      // ✅ Use existing endpoints (no new backend needed)
      const [uRes, sRes, spRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/submissions"),
        api.get("/admin/spots"),
      ]);

      setUsers(uRes.data?.users || []);
      setSubmissions(sRes.data?.submissions || []);
      setSpots(spRes.data?.spots || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ✅ Stats
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => Number(u.is_active) === 1).length;
    const admins = users.filter((u) => u.role === "admin").length;

    const totalSubmissions = submissions.length;

    const totalSpots = spots.length;
    const recentlyUpdatedSpots = spots.filter((sp) => !!sp.last_stuck_at).length;

    return {
      totalUsers,
      activeUsers,
      admins,
      totalSubmissions,
      totalSpots,
      recentlyUpdatedSpots,
    };
  }, [users, submissions, spots]);

  // ✅ recent submissions list (top 5)
  const recentSubmissions = useMemo(() => {
    // already sorted by submitted_at desc in backend, but safe sort again
    const copy = [...submissions];
    copy.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    return copy.slice(0, 5);
  }, [submissions]);

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">
              Manage users, submissions, and poster locations
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={load}
              disabled={loading}
              type="button"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* err removed */}

        {/* Stats Overview */}
        <div className="grid grid-cols-3 mb-8">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value">
              {loading ? "…" : safeNum(stats.totalUsers)}
            </div>
            <p className="text-sm text-muted mt-2">
              Active: {loading ? "…" : safeNum(stats.activeUsers)} | Admins:{" "}
              {loading ? "…" : safeNum(stats.admins)}
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-label">Submissions</div>
            <div className="stat-value">
              {loading ? "…" : safeNum(stats.totalSubmissions)}
            </div>
            <p className="text-sm text-muted mt-2">
              Proof submissions received
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-label">Locations</div>
            <div className="stat-value">
              {loading ? "…" : safeNum(stats.totalSpots)}
            </div>
            <p className="text-sm text-muted mt-2">
              Updated at least once:{" "}
              {loading ? "…" : safeNum(stats.recentlyUpdatedSpots)}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-6">
          <Link to="/admin/users" style={{ textDecoration: "none" }}>
            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">👥</div>
                  <div className="flex-1">
                    <h3 className="card-title">User Management</h3>
                    <p className="card-description">
                      Create, activate, and manage user accounts
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <button className="btn btn-primary btn-block">
                    Manage Users →
                  </button>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin/submissions" style={{ textDecoration: "none" }}>
            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">📋</div>
                  <div className="flex-1">
                    <h3 className="card-title">Submissions</h3>
                    <p className="card-description">
                      Review proof uploads and verify locations
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <button className="btn btn-primary btn-block">
                    View Submissions →
                  </button>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin/spots" style={{ textDecoration: "none" }}>
            <div className="card h-full">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">📍</div>
                  <div className="flex-1">
                    <h3 className="card-title">Poster Locations</h3>
                    <p className="card-description">
                      View all tracked spots and update history
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <button className="btn btn-primary btn-block">
                    Browse Spots →
                  </button>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Submissions */}
        <div className="card mt-8">
          <div className="card-header">
            <h3 className="card-title">Recent Submissions</h3>
            <p className="card-description">Latest proof uploads</p>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="text-muted">Loading recent submissions…</div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-muted">No submissions yet.</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Spot</th>
                      <th>Type</th>
                      <th>Submitted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSubmissions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="font-semibold">{s.user_name || "—"}</div>
                          <div className="text-sm text-muted">{s.user_email || "—"}</div>
                        </td>
                        <td>#{s.spot_id}</td>
                        <td>{s.proof_type}</td>
                        <td>{new Date(s.submitted_at).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>
                          <Link className="btn btn-outline btn-sm" to={`/admin/submissions/${s.id}`}>
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* System Information */}
        <div className="card mt-8">
          <div className="card-header">
            <h3 className="card-title">System Settings</h3>
            <p className="card-description">Global configuration parameters</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-sm font-semibold text-muted mb-1">
                  MATCHING RADIUS
                </div>
                <div className="text-2xl font-bold">20 meters</div>
                <p className="text-sm text-muted mt-1">
                  Location matching threshold
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted mb-1">
                  COOLDOWN PERIOD
                </div>
                <div className="text-2xl font-bold">3 months</div>
                <p className="text-sm text-muted mt-1">
                  Time between spot updates
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted mb-1">
                  ACCEPTED FORMATS
                </div>
                <div className="text-2xl font-bold">Image / Video</div>
                <p className="text-sm text-muted mt-1">
                  Supported proof types
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
