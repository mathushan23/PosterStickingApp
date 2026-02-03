import { useEffect, useState } from "react";
import api from "../../api/axios";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";

export default function SpotDetails() {
  const { id } = useParams();
  const [spot, setSpot] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/spots/${id}`)
      .then((res) => {
        setSpot(res.data.spot);
        setSubs(res.data.submissions || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Spot Details</h1>
            <p className="page-subtitle">Full information for Spot #{id}</p>
            {spot?.address_text && (
              <p className="text-sm text-muted mt-1">📍 {spot.address_text}</p>
            )}

          </div>
          <div className="top-bar-actions">
            <Link to="/admin/spots" className="btn btn-outline btn-sm">← Back to Spots</Link>
          </div>
        </div>
      </div>

      <div className="content-area">
        {loading && (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div className="spinner" style={{ margin: "0 auto", width: "2rem", height: "2rem", borderColor: "rgba(37,99,235,0.2)", borderTopColor: "var(--primary)" }}></div>
              <p className="text-muted mt-3">Loading spot…</p>
            </div>
          </div>
        )}

        {!loading && spot && (
          <>
            {/* Spot Summary Row */}
            <div className="grid grid-cols-3 mb-6">
              <div className="stat-card">
                <div className="stat-icon">📍</div>
                <div className="stat-label">Spot ID</div>
                <div className="stat-value">#{spot.id}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-label">Submissions</div>
                <div className="stat-value">{subs.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-label">Next Available</div>
                <div className="stat-value" style={{ fontSize: "1.15rem" }}>
                  {spot.next_available_date ? new Date(spot.next_available_date).toLocaleDateString() : "Now"}
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Location Information</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-3">
                  <div>
                    <div className="text-sm font-semibold text-muted mb-1">Coordinates</div>
                    <div className="font-semibold">{spot.latitude}, {spot.longitude}</div>

                    {spot.address_text && (
                      <div className="text-sm text-muted" style={{ marginTop: "0.25rem" }}>
                        📍 {spot.address_text}
                      </div>
                    )}

                    {spot.maps_link && (
                      <a
                        href={spot.maps_link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}
                      >
                        🗺️ Open in Google Maps
                      </a>
                    )}

                  </div>
                  <div>
                    <div className="text-sm font-semibold text-muted mb-1">Last Stuck</div>
                    <div className="font-semibold">{spot.last_stuck_at ? new Date(spot.last_stuck_at).toLocaleString() : "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-muted mb-1">Next Available</div>
                    {spot.next_available_date ? (
                      <span className="badge badge-warning">{new Date(spot.next_available_date).toLocaleString()}</span>
                    ) : (
                      <span className="badge badge-success">Available now</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Submissions for this spot */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Submissions at this Spot</h3>
                <p className="card-description">{subs.length} proof submission{subs.length !== 1 ? "s" : ""} recorded</p>
              </div>
              <div className="card-body">
                {subs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "2rem 0" }}>
                    <p className="text-muted">No submissions for this spot yet</p>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {subs.map((s) => (
                    <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                      {/* Sub header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", background: "var(--bg)", borderBottom: "1px solid var(--border-light)" }}>
                        <div>
                          <div className="font-bold" style={{ fontSize: "0.9375rem" }}>{s.user_name}</div>
                          <div className="text-muted text-sm">{s.user_email} &middot; {new Date(s.submitted_at).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const hasImage = s.img_count > 0 || (s.proof_type || "").toUpperCase().includes("IMAGE");
                            const hasVideo = s.vid_count > 0 || (s.proof_type || "").toUpperCase().includes("VIDEO");

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
                          <Link to={`/admin/submissions/${s.id}`} className="btn btn-outline btn-sm">View</Link>
                        </div>
                      </div>

                      {/* Sub body */}
                      <div style={{ padding: "1rem" }}>
                        <div className="preview-container">
                          {s.proof_url?.match(/\.(mp4|mov|webm)$|video/i) ? (
                            <video controls>
                              <source src={base + s.proof_url} />
                            </video>
                          ) : (
                            <img src={base + s.proof_url} alt="proof" />
                          )}
                        </div>

                        <div className="grid grid-cols-2 mt-3" style={{ paddingTop: "0.75rem", borderTop: "1px dashed var(--border)" }}>
                          <div>
                            <div className="text-sm font-semibold text-muted mb-1">Submitted Coords</div>
                            <div className="text-sm font-semibold">{s.submitted_latitude}, {s.submitted_longitude}</div>
                            <a href={`https://www.google.com/maps?q=${s.submitted_latitude},${s.submitted_longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                              🗺️ Maps
                            </a>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-muted mb-1">Spot Coords</div>
                            <div className="text-sm font-semibold">{s.spot_latitude}, {s.spot_longitude}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
