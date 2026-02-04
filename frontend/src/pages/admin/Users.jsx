import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";

export default function Users() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await api.get("/admin/users");
    setItems(res.data.users || []);
  }

  useEffect(() => { load(); }, []);

  async function createUser(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/admin/users", form);
      toast.success("User created successfully");
      setForm({ name: "", email: "", password: "", role: "user" });
      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id, current) {
    try {
      await api.patch(`/admin/users/${id}/status`, { is_active: !current });
      toast.success(`User ${!current ? "activated" : "deactivated"} successfully`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Update failed");
    }
  }

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-subtitle">Create and manage user accounts</p>
          </div>
          <div className="top-bar-actions">
            <span className="badge badge-info">{items.length} User{items.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="content-area">
        <div className="grid grid-cols-2">
          {/* Create User Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Create User</h3>
              <p className="card-description">New accounts are created by admins only — no signup flow</p>
            </div>
            <div className="card-body">
              <form onSubmit={createUser}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Full name" />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="user@example.com" />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="password" />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
                  {loading ? (<><span className="spinner"></span> Creating…</>) : "Create User"}
                </button>

                {/* msg alert removed */}
              </form>
            </div>
          </div>

          {/* Users List */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Users List</h3>
              <p className="card-description">Toggle status to activate or deactivate accounts</p>
            </div>
            <div className="card-body">
              {items.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
                  <p className="text-muted">No users yet</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {items.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--bg)" }}>
                    <div>
                      <div className="font-bold" style={{ fontSize: "0.9375rem" }}>{u.name}</div>
                      <div className="text-muted text-sm">{u.email}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-secondary"}`}>{u.role}</span>
                        <span className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}>{u.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}
                      onClick={() => toggleStatus(u.id, !!u.is_active)}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
