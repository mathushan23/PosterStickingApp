import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";

export default function AssignmentHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/admin/spot-assignments");
      setItems(res.data.assignments || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load assignment history");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout
      title="Assignment History"
      subtitle="All admin-assigned poster tasks"
      userLabel="Admin"
      nav={[
        { label: "Dashboard", to: "/admin/dashboard", variant: "ghost" },
        { label: "Spots", to: "/admin/spots", variant: "ghost" },
      ]}
    >
      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="card p-6 text-center text-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="card p-6 text-center text-muted">
          No assignment history found.
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Spot</th>
                <th>User</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>Map</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const mapLink =
                  a.latitude && a.longitude
                    ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}`
                    : null;

                return (
                  <tr key={a.id}>
                    <td>
                      <div>
                        <b>#{a.spot_id}</b>
                      </div>
                      <div className="text-sm text-muted">
                        {a.address_text || "—"}
                      </div>
                    </td>

                    <td>
                      <div>{a.user_name || "—"}</div>
                      <div className="text-sm text-muted">{a.user_email || ""}</div>
                    </td>

                    <td>
                      <span
                        className={`badge badge-${
                          a.status === "completed"
                            ? "success"
                            : a.status === "cancelled"
                              ? "danger"
                              : "warning"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>

                    <td>{a.assigned_at ? new Date(a.assigned_at).toLocaleString() : "-"}</td>

                    <td>
                      {a.completed_at ? new Date(a.completed_at).toLocaleString() : "-"}
                    </td>

                    <td>
                      {mapLink ? (
                        <a
                          className="btn btn-outline btn-sm"
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Map
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
