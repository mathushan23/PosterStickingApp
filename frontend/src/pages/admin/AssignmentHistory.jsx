import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";

export default function AssignmentHistory() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/admin/spot-assignments")
      .then(res => setItems(res.data.assignments || []));
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
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Spot</th>
              <th>User</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td>#{a.spot_id}</td>
                <td>{a.user_name}</td>
                <td>
                  <span className={`badge badge-${a.status === "completed" ? "success" : "warning"}`}>
                    {a.status}
                  </span>
                </td>
                <td>{new Date(a.assigned_at).toLocaleString()}</td>
                <td>{a.completed_at ? new Date(a.completed_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
