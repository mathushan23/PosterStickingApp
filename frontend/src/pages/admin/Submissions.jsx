import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-hot-toast";
import Layout from "../../components/Layout";

export default function Submissions() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ user: "", start: "", end: "" });
  const [loading, setLoading] = useState(false);

  const base = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  function toMySQLDateTime(v) {
    if (!v) return "";
    return v.replace("T", " ") + ":00";
  }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filters.user.trim()) params.user = filters.user.trim();
      if (filters.start) params.start = toMySQLDateTime(filters.start);
      if (filters.end) params.end = toMySQLDateTime(filters.end);

      const res = await api.get("/admin/submissions", { params });
      setItems(res.data.submissions || []);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load submissions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Submissions</h1>
            <p className="page-subtitle">View proofs, locations and cooldown status</p>
          </div>
          <div className="top-bar-actions">
            <span className="badge badge-info">{items.length} Result{items.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* Filters + Summary row */}
        <div className="grid grid-cols-2 mb-6">
          {/* Filters Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Filters</h3>
              <p className="card-description">Search by user and date range</p>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">User</label>
                <input className="form-input" placeholder="Name or email" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 mb-4">
                <div className="form-group">
                  <label className="form-label">Start</label>
                  <input className="form-input" type="datetime-local" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End</label>
                  <input className="form-input" type="datetime-local" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={load} disabled={loading}>
                {loading ? (<><span className="spinner"></span> Applying...</>) : "Apply"}
              </button>

              {/* errMsg removed */}
            </div>
          </div>

          {/* Summary Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Summary</h3>
              <p className="card-description">Click any row to open full details</p>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-3">
                <div className="stat-card" style={{ border: "none", padding: "1rem 0.5rem", background: "transparent" }}>
                  <div className="stat-label">Results</div>
                  <div className="stat-value">{items.length}</div>
                </div>
                <div className="stat-card" style={{ border: "none", padding: "1rem 0.5rem", background: "transparent" }}>
                  <div className="stat-label">Radius</div>
                  <div className="stat-value">20m</div>
                </div>
                <div className="stat-card" style={{ border: "none", padding: "1rem 0.5rem", background: "transparent" }}>
                  <div className="stat-label">Cooldown</div>
                  <div className="stat-value">3 mo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Submitted</th>
                <th>Proof</th>
                <th>Submitted Spot Address</th>
                <th>Submitted Spot Cordinate</th>
                <th>Last Stuck</th>
                <th>Next Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
                    <p className="text-muted">No submissions found</p>
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-bold" style={{ fontSize: "0.9375rem" }}>{s.user_name}</div>
                      <div className="text-muted text-sm">{s.user_email}</div>
                    </td>

                    <td>
                      <div className="text-sm">{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}</div>
                    </td>

                    <td>
                      <div style={{ position: 'relative' }}>
                        {s.proof_url?.match(/\.(mp4|mov|webm)$|video/i) ? (
                          <video controls style={{ width: 160, height: 90, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <source src={base + s.proof_url} />
                          </video>
                        ) : (
                          <img src={base + s.proof_url} alt="proof" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
                        )}
                        <div style={{ marginTop: '0.5rem' }}>
                          {(() => {
                            const pType = (s.proof_type || "").toUpperCase();
                            const hasImage = Number(s.img_count) > 0 || pType.includes("IMAGE");
                            const hasVideo = Number(s.vid_count) > 0 || pType.includes("VIDEO");

                            let label = "";
                            let icon = "";
                            let badgeClass = "";

                            if (hasImage && hasVideo) {
                              label = "IMAGE and VIDEO";
                              icon = "📷🎬 ";
                              badgeClass = "badge-info";
                            } else if (hasVideo) {
                              label = "VIDEOS";
                              icon = "🎬 ";
                              badgeClass = "badge-secondary";
                            } else {
                              label = "IMAGE";
                              icon = "📷 ";
                              badgeClass = "badge-info";
                            }

                            return (
                              <span
                                className={`badge ${badgeClass}`}
                                style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                {icon}{label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    <td>
                      {s.address_text ? (
                        <>
                          <div className="text-sm font-semibold" style={{ maxWidth: 260, lineHeight: 1.3 }}>
                            📍 {s.address_text}
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${s.spot_latitude},${s.spot_longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}
                          >
                            🗺️ Open map
                          </a>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold">
                            {s.submitted_latitude}, {s.submitted_longitude}
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${s.submitted_latitude},${s.submitted_longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}
                          >
                            🗺️ Open map
                          </a>
                        </>
                      )}
                    </td>


                    <td>
                      <div className="text-sm font-semibold">Lat: {s.spot_latitude}<br />Lng: {s.spot_longitude}</div>
                    </td>

                    <td>
                      <div className="text-sm">{s.last_stuck_at ? new Date(s.last_stuck_at).toLocaleString() : "—"}</div>
                    </td>

                    <td>
                      {s.next_available_date ? (
                        <span className="badge badge-warning">{new Date(s.next_available_date).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </td>

                    <td>
                      <Link to={`/admin/submissions/${s.id}`} className="btn btn-outline btn-sm">Details</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
