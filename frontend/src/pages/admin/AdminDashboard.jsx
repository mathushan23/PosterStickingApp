import { Link } from "react-router-dom";
import Layout from "../../components/Layout";

export default function AdminDashboard() {
  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Manage users, submissions, and poster locations</p>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 mb-8">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value">—</div>
            <p className="text-sm text-muted mt-2">Active accounts in system</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-label">Submissions</div>
            <div className="stat-value">—</div>
            <p className="text-sm text-muted mt-2">Proof submissions received</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-label">Locations</div>
            <div className="stat-value">—</div>
            <p className="text-sm text-muted mt-2">Tracked poster spots</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-6">
          <Link to="/admin/users" style={{ textDecoration: 'none' }}>
            <div className="card">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div style={{ fontSize: '3rem' }}>👥</div>
                  <div className="flex-1">
                    <h3 className="card-title">User Management</h3>
                    <p className="card-description mt-1">
                      Create, activate, and manage user accounts
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="btn btn-primary">
                    Manage Users →
                  </button>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin/submissions" style={{ textDecoration: 'none' }}>
            <div className="card">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div style={{ fontSize: '3rem' }}>📋</div>
                  <div className="flex-1">
                    <h3 className="card-title">Submissions</h3>
                    <p className="card-description mt-1">
                      Review proof uploads and verify locations
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="btn btn-primary">
                    View Submissions →
                  </button>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/admin/spots" style={{ textDecoration: 'none' }}>
            <div className="card">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div style={{ fontSize: '3rem' }}>📍</div>
                  <div className="flex-1">
                    <h3 className="card-title">Poster Locations</h3>
                    <p className="card-description mt-1">
                      View all tracked spots and update history
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="btn btn-primary">
                    Browse Spots →
                  </button>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* System Information */}
        <div className="card mt-8">
          <div className="card-header">
            <h3 className="card-title">System Configuration</h3>
            <p className="card-description">Current system settings and parameters</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm font-semibold text-muted mb-1">MATCHING RADIUS</div>
                <div className="text-2xl font-bold">20 meters</div>
                <p className="text-sm text-muted mt-1">Location matching threshold</p>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted mb-1">COOLDOWN PERIOD</div>
                <div className="text-2xl font-bold">3 months</div>
                <p className="text-sm text-muted mt-1">Time between spot updates</p>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted mb-1">ACCEPTED FORMATS</div>
                <div className="text-2xl font-bold">Image / Video</div>
                <p className="text-sm text-muted mt-1">Supported proof types</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
