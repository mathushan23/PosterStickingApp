import { Link } from "react-router-dom";
import Layout from "../../components/Layout";

export default function UserDashboard() {
  return (
    <Layout role="user">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Submit proof and track your poster placements</p>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 mb-8">
          <div className="stat-card">
            <div className="stat-icon">📏</div>
            <div className="stat-label">Matching Radius</div>
            <div className="stat-value">20m</div>
            <p className="text-sm text-muted mt-2">Location detection range</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-label">Cooldown Period</div>
            <div className="stat-value">3 mo</div>
            <p className="text-sm text-muted mt-2">Wait time per location</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📤</div>
            <div className="stat-label">Proof Format</div>
            <div className="stat-value">1 File</div>
            <p className="text-sm text-muted mt-2">Image or video required</p>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="card-title">💡 Quick Start Guide</h3>
            <p className="card-description">Follow these steps to submit your proof</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: '700'
                  }}>1</div>
                  <h4 className="font-semibold">Capture Location</h4>
                </div>
                <p className="text-sm text-muted">
                  Enable location services and capture your current GPS coordinates
                </p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: '700'
                  }}>2</div>
                  <h4 className="font-semibold">Upload Proof</h4>
                </div>
                <p className="text-sm text-muted">
                  Select one clear photo or video showing the poster placement
                </p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: '700'
                  }}>3</div>
                  <h4 className="font-semibold">Submit & Track</h4>
                </div>
                <p className="text-sm text-muted">
                  Submit your proof and check your history to track all submissions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-6">
          <Link to="/user/submit" style={{ textDecoration: 'none' }}>
            <div className="card">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div style={{ fontSize: '3.5rem' }}>📸</div>
                  <div className="flex-1">
                    <h3 className="card-title">Submit New Proof</h3>
                    <p className="card-description mt-2">
                      Upload your poster placement evidence with location data
                    </p>
                    <div className="mt-4">
                      <button className="btn btn-primary btn-lg">
                        Start Submission →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/user/history" style={{ textDecoration: 'none' }}>
            <div className="card">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div style={{ fontSize: '3.5rem' }}>📊</div>
                  <div className="flex-1">
                    <h3 className="card-title">View History</h3>
                    <p className="card-description mt-2">
                      Check your past submissions and their current status
                    </p>
                    <div className="mt-4">
                      <button className="btn btn-outline btn-lg">
                        View Records →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Important Notice */}
        <div className="alert alert-warning mt-8">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <div className="alert-title">Cooldown Policy</div>
            The same location (within 20 meters) can only be updated once every 3 months. 
            If a recent submission exists, you'll see the next available date.
          </div>
        </div>
      </div>
    </Layout>
  );
}
