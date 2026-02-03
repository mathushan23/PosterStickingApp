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
            {/* Proof Media Gallery */}
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Proof Media ({s.proofs?.length || 0})</h3>
                <p className="card-description">Media evidence uploaded by {s.user_name}</p>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(s.proofs && s.proofs.length > 0 ? s.proofs : [s]).map((proof, index) => (
                    <div key={index} className="proof-item">
                      <div className="text-xs font-semibold mb-2 text-muted uppercase tracking-wider">
                        {proof.proof_type} #{index + 1}
                      </div>
                      <div className="preview-container" style={{ height: '300px' }}>
                        {proof.proof_type === "image" ? (
                          <img
                            src={base + proof.proof_url}
                            alt={`proof-${index}`}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8f9fa', borderRadius: '8px' }}
                          />
                        ) : (
                          <video controls style={{ width: '100%', height: '100%', borderRadius: '8px' }}>
                            <source src={base + proof.proof_url} />
                          </video>
                        )}
                      </div>
                    </div>
                  ))}
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
                      {(() => {
                        const proofs = s.proofs && s.proofs.length > 0 ? s.proofs : [s];
                        const hasImage = proofs.some(p => String(p.proof_type).toLowerCase().includes("image"));
                        const hasVideo = proofs.some(p => String(p.proof_type).toLowerCase().includes("video"));

                        let displayType = "";
                        let displayIcon = "";
                        let badgeClass = "";

                        if (hasImage && hasVideo) {
                          displayType = "IMAGE and VIDEO";
                          displayIcon = "📷🎬";
                          badgeClass = "badge-info";
                        } else if (hasVideo) {
                          displayType = "VIDEOS";
                          displayIcon = "🎬";
                          badgeClass = "badge-secondary";
                        } else {
                          displayType = "IMAGE";
                          displayIcon = "📷";
                          badgeClass = "badge-info";
                        }

                        return (
                          <span
                            className={`badge ${badgeClass}`}
                            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {displayIcon} {displayType}
                          </span>
                        );
                      })()}
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

                      {s.address_text ? (
                        <>
                          <div className="font-semibold" style={{ lineHeight: 1.4 }}>
                            📍 {s.address_text}
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${s.spot_latitude},${s.spot_longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}
                          >
                            🗺️ Open in Google Maps
                          </a>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold">
                            {s.submitted_latitude}, {s.submitted_longitude}
                          </div>
                          {s.maps_link && (
                            <a
                              href={s.maps_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}
                            >
                              🗺️ Open in Google Maps
                            </a>
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-muted mb-1">Submitted Location Coordinates</div>
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