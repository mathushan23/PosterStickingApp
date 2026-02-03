import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { Link } from "react-router-dom";

export default function UserAssignments() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await api.get("/user/assignments");
      setItems(res.data.assignments || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load assignments");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout
      title="Assigned Tasks"
      subtitle="Complete the assigned spot and upload proof."
      userLabel="User"
      nav={[
        { label: "Dashboard", to: "/user/dashboard", variant: "ghost" },
        { label: "Submit Proof", to: "/user/submit", variant: "primary" },
      ]}
    >
      {err && <div className="alert alert-error">{err}</div>}

      {items.length === 0 && !err ? (
        <div className="card p-6 text-center text-muted">No assignments yet.</div>
      ) : (
        <div className="grid grid-cols-2">
          {items.map((a) => (
            <div key={a.assignment_id} className="card">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="card-title">Spot #{a.spot_id}</div>
                    <div className="text-sm text-muted">
                      {a.address_text || "—"}
                    </div>
                  </div>
                  <span className="badge badge-warning">Assigned</span>
                </div>

                <div className="mt-4 text-sm">
                  <b>Coords</b>
                  <div>{a.latitude}, {a.longitude}</div>
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    className="btn btn-outline btn-sm"
                    href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Map
                  </a>

                  <Link
                    className="btn btn-primary btn-sm"
                    to={`/user/submit?assignment_id=${a.assignment_id}`}
                  >
                    Upload Proof
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
