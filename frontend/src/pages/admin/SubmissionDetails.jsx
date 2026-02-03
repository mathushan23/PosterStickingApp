import { useEffect, useState } from "react";
import api from "../../api/axios";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";

export default function SubmissionDetails() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);

  const base = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/submissions/${id}`)
      .then((res) => setS(res.data.submission))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Submission Details</h1>
            <p className="page-subtitle">Full details for submission #{id}</p>
          </div>
          <div className="top-bar-actions">
            <Link to="/admin/submissions" className="btn btn-outline btn-sm">← Back to Submissions</Link>
          </div>
        </div>
      </div>

      <div className="content-area" style={{ maxWidth: "900px" }}>
        {loading && (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div className="spinner" style={{ margin: "0 auto", width: "2rem", height: "2rem", borderColor: "rgba(37,99,235,0.2)", borderTopColor: "var(--primary)" }}></div>
              <p className="text-muted mt-3">Loading submission…</p>
            </div>
          </div>
        )}

        {!loading && s && (
          <>
            {/* Proof Media */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Proof Media</h3>
                <p className="card-description">{s.proof_type === "image" ? "Image" : "Video"} uploaded by {s.user_name}</p>
              </div>
              <div className="card-body">
                <div className="preview-container">
                  {s.proof_type === "image" ? (
                    <img src={base + s.proof_url} alt="proof" />
                  ) : (
                    <video controls>
                      <source src={base + s.proof_url} />
                    </video>
                  )}
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2">
              {/* User & Submission Info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Submission Info</h3>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">User</div>
                      <div className="font-bold" style={{ fontSize: "0.9375rem" }}>{s.user_name}</div>
                      <div className="text-sm text-muted">{s.user_email}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Submitted At</div>
                      <div className="font-semibold">{new Date(s.submitted_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Proof Type</div>
                      <span className={`badge ${s.proof_type === "image" ? "badge-info" : "badge-secondary"}`}>
                        {s.proof_type === "image" ? "📷 Image" : "🎬 Video"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Location Info</h3>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Submitted Location</div>
                      <div className="font-semibold">{s.submitted_latitude}, {s.submitted_longitude}</div>
                      {s.maps_link && (
                        <a href={s.maps_link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                          🗺️ Open in Google Maps
                        </a>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Spot Location</div>
                      <div className="font-semibold">{s.spot_latitude}, {s.spot_longitude}</div>
                      <a href={`https://www.google.com/maps?q=${s.spot_latitude},${s.spot_longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                        🗺️ Open in Google Maps
                      </a>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Last Stuck</div>
                      <div className="font-semibold">{s.last_stuck_at ? new Date(s.last_stuck_at).toLocaleString() : "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Next Available</div>
                      {s.next_available_date ? (
                        <span className="badge badge-warning">{new Date(s.next_available_date).toLocaleString()}</span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
