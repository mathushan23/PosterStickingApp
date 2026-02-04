import { useEffect, useMemo, useState, useCallback } from "react";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";

export default function History() {
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  // fullscreen modal state: { url, type: "image"|"video" } | null
  const [modal, setModal] = useState(null);

  const base = useMemo(
    () =>
      (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, ""),
    []
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/user/submissions");
      setItems(res.data.submissions || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // close modal on ESC
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") setModal(null);
  }, []);

  useEffect(() => {
    if (modal) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [modal, handleKey]);

  return (
    <Layout role="user">
      {/* ── Fullscreen Media Modal ── */}
      {modal && (
        <div className="media-modal-overlay" onClick={() => setModal(null)}>
          <button className="media-modal-close" onClick={() => setModal(null)}>&times;</button>
          <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
            {modal.type === "image" ? (
              <img src={modal.url} alt="fullscreen proof" />
            ) : (
              <video controls autoPlay>
                <source src={modal.url} type="video/mp4" />
              </video>
            )}
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">My History</h1>
            <p className="page-subtitle">Your submitted proofs with location and spot info</p>
          </div>
          <div className="top-bar-actions">
            <span className="badge badge-info">{items.length} Submission{items.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="content-area" style={{ maxWidth: 900 }}>
        {/* Error */}
        {/* Error removed */}

        {/* Loading */}
        {loading && (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div className="spinner" style={{ margin: "0 auto", width: "2rem", height: "2rem", borderColor: "rgba(37,99,235,0.2)", borderTopColor: "var(--primary)" }}></div>
              <p className="text-muted mt-3">Loading your submissions…</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div style={{ fontSize: "2.75rem", marginBottom: "0.5rem" }}>📜</div>
              <h3 className="card-title">No Submissions Yet</h3>
              <p className="card-description mt-2">Your proof submissions will appear here once you start submitting.</p>
            </div>
          </div>
        )}

        {/* ── Submission List ── */}
        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {items.map((s) => {
              const isOpen = openId === s.id;

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
                <div key={s.id}>
                  {/* ── Collapsed row (always visible) ── */}
                  <div className="card" style={{ overflow: "visible" }}>
                    <div
                      className="card-header"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", cursor: "pointer", userSelect: "none" }}
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "1.25rem" }}>{displayIcon}</span>
                        <div>
                          <h3 className="card-title" style={{ marginBottom: 0 }}>Spot #{s.spot_id}</h3>
                          {s.address_text && (
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              📍 {s.address_text}
                            </div>
                          )}

                          <p className="card-description">
                            Submission #{s.id} &middot; {new Date(s.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`badge ${badgeClass}`}
                          style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {displayIcon} {displayType}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          {isOpen ? "▲ Hide" : "▼ Expand"}
                        </span>
                      </div>
                    </div>

                    {/* ── Expanded detail (mirrors SubmissionDetails layout exactly) ── */}
                    {isOpen && (
                      <>
                        {/* Proof Media card */}
                        <div style={{ borderTop: "1px solid var(--border-light)" }}>
                          <div className="card-header" style={{ background: "var(--bg)" }}>
                            <h3 className="card-title">Proof Media ({s.proofs?.length || 0})</h3>
                            <p className="card-description">
                              Media evidence uploaded for this submission
                            </p>
                          </div>
                          <div className="card-body">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(s.proofs && s.proofs.length > 0 ? s.proofs : [s]).map((proof, index) => {
                                const pUrl = base + proof.proof_url;
                                return (
                                  <div key={index} className="proof-item">
                                    <div className="text-xs font-semibold mb-2 text-muted uppercase tracking-wider">
                                      {proof.proof_type} #{index + 1}
                                    </div>
                                    <div className="preview-wrapper">
                                      <div className="preview-container" style={{ marginTop: 0, height: '200px' }}>
                                        {proof.proof_type === "image" ? (
                                          <img src={pUrl} alt={`proof-${index}`} style={{ height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                          <video controls style={{ height: '100%' }}>
                                            <source src={pUrl} type="video/mp4" />
                                          </video>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="fullscreen-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModal({ url: pUrl, type: proof.proof_type });
                                        }}
                                        title="Open fullscreen"
                                      >
                                        ⛶
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>


                        {/* Two-column info grid — same as SubmissionDetails */}
                        <div className="card-body" style={{ paddingTop: 0 }}>
                          <div className="grid grid-cols-2">
                            {/* Left — Submission Info */}
                            <div className="card">
                              <div className="card-header">
                                <h3 className="card-title">Submission Info</h3>
                              </div>
                              <div className="card-body">
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                  <div>
                                    <div className="text-sm font-semibold text-muted mb-1">Submission ID</div>
                                    <div className="font-bold" style={{ fontSize: "0.9375rem" }}>#{s.id}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-muted mb-1">Submitted At</div>
                                    <div className="font-semibold">{new Date(s.submitted_at).toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-muted mb-1">Proof Type</div>
                                    <span
                                      className={`badge ${badgeClass}`}
                                      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      {displayIcon} {displayType}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right — Location Info */}
                            <div className="card">
                              <div className="card-header">
                                <h3 className="card-title">Location Info</h3>
                              </div>
                              <div className="card-body">
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                  <div>
                                    <div className="text-sm font-semibold text-muted mb-1">Submitted Location</div>
                                    <div className="font-semibold">{s.submitted_latitude}, {s.submitted_longitude}</div>
                                    {s.maps_link ? (
                                      <a href={s.maps_link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                                        🗺️ Open in Google Maps
                                      </a>
                                    ) : (
                                      <a href={`https://www.google.com/maps?q=${s.submitted_latitude},${s.submitted_longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
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
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
