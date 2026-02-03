import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { Link } from "react-router-dom";

export default function Spots() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/admin/spots");
      setItems(res.data.spots || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load spots");
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
            <h1 className="page-title">Poster Spots</h1>
            <p className="page-subtitle">All tracked locations with cooldown and submission counts</p>
          </div>
          <div className="top-bar-actions">
            <span className="badge badge-info">{items.length} Spot{items.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="content-area">
        {err && (
          <div className="alert alert-error mb-6">
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">{err}</div>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Spot</th>
                <th>Last Stuck</th>
                <th>Next Available</th>
                <th>Submissions</th>
                <th>Map</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div className="spinner" style={{ margin: "0 auto", width: "1.5rem", height: "1.5rem", borderColor: "rgba(37,99,235,0.2)", borderTopColor: "var(--primary)" }}></div>
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📍</div>
                    <p className="text-muted">No spots yet</p>
                  </td>
                </tr>
              )}

              {!loading && items.map((sp) => (
                <tr key={sp.id}>
                  <td>
                    <div className="font-bold" style={{ fontSize: "0.9375rem" }}>
                      Spot #{sp.id}
                    </div>

                    {sp.address_text ? (
                      <div className="text-muted text-sm" style={{ maxWidth: "260px" }}>
                        📍 {sp.address_text}
                      </div>
                    ) : (
                      <div className="text-muted text-sm">
                        {sp.latitude}, {sp.longitude}
                      </div>
                    )}
                  </td>


                  <td>
                    <div className="text-sm">{sp.last_stuck_at ? new Date(sp.last_stuck_at).toLocaleString() : "—"}</div>
                  </td>

                  <td>
                    {sp.next_available_date ? (
                      <span className="badge badge-warning">{new Date(sp.next_available_date).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </td>

                  <td>
                    <span className="badge badge-info">{sp.submissions_count}</span>
                  </td>

                  <td>
                    <a href={`https://www.google.com/maps?q=${sp.latitude},${sp.longitude}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "0.875rem", fontWeight: 600 }}>
                      🗺️ Open Map
                    </a>
                  </td>

                  <td>
                    <Link to={`/admin/spots/${sp.id}`} className="btn btn-outline btn-sm">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
