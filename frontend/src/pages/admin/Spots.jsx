import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";
import { Link } from "react-router-dom";

// ✅ Leaflet (OpenStreetMap)
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ✅ Fix default marker icons (bundlers)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ✅ stable colors per user_id
const USER_COLORS = [
  "#2563eb", "#16a34a", "#f97316", "#8b5cf6", "#ef4444",
  "#0ea5e9", "#22c55e", "#eab308", "#db2777", "#14b8a6",
];

function colorFromUserId(userId) {
  if (!userId) return "#64748b"; // unassigned = gray
  const n = Number(userId);
  const idx = Math.abs(n) % USER_COLORS.length;
  return USER_COLORS[idx];
}

// ✅ pin: fill=user color, red ring if cooldown not finished (stucked)
function makeUserPin({ fill = "#2563eb", stucked = false }) {
  const ring = stucked
    ? "0 0 0 4px rgba(239,68,68,.35)"
    : "0 0 0 2px rgba(255,255,255,.9)";
  const border = stucked ? "2px solid rgba(239,68,68,.9)" : "2px solid white";

  return L.divIcon({
    className: "spot-pin",
    html: `<div style="
      width:16px;height:16px;border-radius:999px;
      background:${fill};
      ${border};
      box-shadow:${ring}, 0 10px 18px rgba(0,0,0,.22);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

export default function Spots() {
  const [items, setItems] = useState([]);
  const [usersRaw, setUsersRaw] = useState([]); // ✅ all users (active + inactive)
  const [loading, setLoading] = useState(true);

  // ✅ Filters
  const [district, setDistrict] = useState("All");
  const [userFilter, setUserFilter] = useState("All"); // assigned_user_id

  async function load() {
    setLoading(true);
    try {
      const [spotsRes, usersRes] = await Promise.all([
        api.get("/admin/spots"),
        api.get("/admin/users"),
      ]);

      setItems(spotsRes.data.spots || []);

      // ✅ keep ALL users (role=user) even if inactive
      const allUsers = (usersRes.data.users || []).filter((u) => u.role === "user");
      setUsersRaw(allUsers);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ✅ District options from spots
  const districts = useMemo(() => {
    const set = new Set();
    items.forEach((s) => {
      if (s.district) set.add(s.district);
    });
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  // ✅ User filter options: ALL users (inactive shown disabled + gray)
  const users = useMemo(() => {
    const list = usersRaw
      .map((u) => ({
        id: String(u.id),
        name: u.name || `User #${u.id}`,
        is_active: Number(u.is_active) === 1,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [
      { id: "All", name: "All Users", is_active: true },
      { id: "UNASSIGNED", name: "Unassigned", is_active: true },
      ...list,
    ];
  }, [usersRaw]);

  // ✅ TABLE filters (strict)
  const filteredItems = useMemo(() => {
    return items.filter((s) => {
      const okDistrict =
        district === "All" ? true : (s.district || "Unknown") === district;

      const okUser =
        userFilter === "All"
          ? true
          : userFilter === "UNASSIGNED"
          ? !s.assigned_user_id
          : String(s.assigned_user_id || "") === String(userFilter);

      return okDistrict && okUser;
    });
  }, [items, district, userFilter]);

  // ✅ MAP filters (special rule)
  // If userFilter is specific user => show that user's spots + UNASSIGNED that satisfy district filter
  const mapItems = useMemo(() => {
    return items.filter((s) => {
      const okDistrict =
        district === "All" ? true : (s.district || "Unknown") === district;
      if (!okDistrict) return false;

      if (userFilter === "All") return true;

      if (userFilter === "UNASSIGNED") return !s.assigned_user_id;

      // specific user: user spots + unassigned
      const isSelectedUser = String(s.assigned_user_id || "") === String(userFilter);
      const isUnassigned = !s.assigned_user_id;
      return isSelectedUser || isUnassigned;
    });
  }, [items, district, userFilter]);

  // ✅ Sri Lanka center
  const slCenter = [7.8731, 80.7718];

  // ✅ cooldown = if next_available_date exists and still in future
  const isInCooldown = (sp) => {
    if (!sp.next_available_date) return false;
    return new Date(sp.next_available_date) > new Date();
  };

  return (
    <Layout role="admin">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Poster Spots</h1>
            <p className="page-subtitle">
              Map pins colored by assigned user. If user filter selected, map shows that user + unassigned spots.
            </p>
          </div>

          <div
            className="top-bar-actions"
            style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <select
              className="input"
              style={{ minWidth: 200 }}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={loading}
              title="Filter by district"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              className="input"
              style={{ minWidth: 240 }}
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              disabled={loading}
              title="Filter by assigned user"
            >
              {users.map((u) => (
                <option
                  key={u.id}
                  value={u.id}
                  disabled={u.id !== "All" && u.id !== "UNASSIGNED" && !u.is_active}
                  style={
                    u.id !== "All" && u.id !== "UNASSIGNED" && !u.is_active
                      ? { color: "#94a3b8" } // gray
                      : undefined
                  }
                >
                  {u.id !== "All" && u.id !== "UNASSIGNED" && !u.is_active
                    ? `${u.name} (Inactive)`
                    : u.name}
                </option>
              ))}
            </select>



            <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* ✅ MAP */}
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 800 }}>Map View</div>

            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#64748b", display: "inline-block" }} />
                Fill color = Assigned User (unassigned = gray)
              </span>

              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "#ef4444",
                    display: "inline-block",
                    boxShadow: "0 0 0 3px rgba(239,68,68,.25)",
                  }}
                />
                Red ring = In cooldown
              </span>
            </div>
          </div>

          <div style={{ height: 420, borderRadius: 12, overflow: "hidden" }}>
            <MapContainer center={slCenter} zoom={8} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {!loading &&
                mapItems
                  .filter((sp) => sp.latitude && sp.longitude)
                  .map((sp) => {
                    const fill = colorFromUserId(sp.assigned_user_id);
                    const stucked = isInCooldown(sp);

                    return (
                      <Marker
                        key={sp.id}
                        position={[Number(sp.latitude), Number(sp.longitude)]}
                        icon={makeUserPin({ fill, stucked })}
                      >
                        <Popup>
                          <div style={{ minWidth: 250 }}>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>Spot #{sp.id}</div>

                            <div style={{ fontSize: 13, marginBottom: 6 }}>
                              <b>District:</b> {sp.district || "Unknown"}
                            </div>

                            <div style={{ fontSize: 13, marginBottom: 6 }}>
                              <b>Assigned User:</b>{" "}
                              {sp.assigned_user_name
                                ? sp.assigned_user_name
                                : sp.assigned_user_id
                                ? `User #${sp.assigned_user_id}`
                                : "Unassigned"}
                            </div>

                            <div style={{ fontSize: 13, marginBottom: 6 }}>
                              <b>Last Stuck By:</b> {sp.last_stuck_by_name || "—"}
                            </div>

                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                              {sp.address_text ? `📍 ${sp.address_text}` : `${sp.latitude}, ${sp.longitude}`}
                            </div>

                            <div style={{ fontSize: 13, marginBottom: 6 }}>
                              <b>Last Stuck:</b>{" "}
                              {sp.last_stuck_at ? new Date(sp.last_stuck_at).toLocaleString() : "—"}
                            </div>

                            <div style={{ fontSize: 13, marginBottom: 6 }}>
                              <b>Next Available:</b>{" "}
                              {sp.next_available_date
                                ? new Date(sp.next_available_date).toLocaleDateString()
                                : "—"}
                            </div>

                            <div style={{ fontSize: 13, marginBottom: 10 }}>
                              <b>Submissions:</b> {sp.submissions_count ?? 0}
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <a
                                href={`https://www.google.com/maps?q=${sp.latitude},${sp.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                              >
                                🗺️ Maps
                              </a>

                              <Link to={`/admin/spots/${sp.id}`} className="btn btn-primary btn-sm">
                                Details
                              </Link>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
            </MapContainer>
          </div>
        </div>

        {/* ✅ TABLE */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Spot</th>
                <th>District</th>
                <th>Assigned User</th>
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
                  <td colSpan="8" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div
                      className="spinner"
                      style={{
                        margin: "0 auto",
                        width: "1.5rem",
                        height: "1.5rem",
                        borderColor: "rgba(37,99,235,0.2)",
                        borderTopColor: "var(--primary)",
                      }}
                    />
                  </td>
                </tr>
              )}

              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📍</div>
                    <p className="text-muted">No spots for selected filters</p>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredItems.map((sp) => (
                  <tr key={sp.id}>
                    <td>
                      <div className="font-bold" style={{ fontSize: "0.9375rem" }}>
                        Spot #{sp.id}
                      </div>

                      <div className="text-muted text-sm" style={{ maxWidth: "260px" }}>
                        {sp.address_text ? `📍 ${sp.address_text}` : `${sp.latitude}, ${sp.longitude}`}
                      </div>
                    </td>

                    <td>
                      <span className="text-sm">{sp.district || "Unknown"}</span>
                    </td>

                    <td>
                      <span className="text-sm">
                        {sp.assigned_user_name
                          ? sp.assigned_user_name
                          : sp.assigned_user_id
                          ? `User #${sp.assigned_user_id}`
                          : "Unassigned"}
                      </span>
                    </td>

                    <td>
                      <div className="text-sm">
                        {sp.last_stuck_at ? new Date(sp.last_stuck_at).toLocaleString() : "—"}
                      </div>
                      <div className="text-muted text-sm">by {sp.last_stuck_by_name || "—"}</div>
                    </td>

                    <td>
                      {sp.next_available_date ? (
                        <span className="badge badge-warning">
                          {new Date(sp.next_available_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </td>

                    <td>
                      <span className="badge badge-info">{sp.submissions_count ?? 0}</span>
                    </td>

                    <td>
                      <a
                        href={`https://www.google.com/maps?q=${sp.latitude},${sp.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--primary)", fontSize: "0.875rem", fontWeight: 600 }}
                      >
                        🗺️ Open Map
                      </a>
                    </td>

                    <td>
                      <Link to={`/admin/spots/${sp.id}`} className="btn btn-outline btn-sm">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <style>{`
          .spot-pin { background: transparent !important; border: none !important; }
        `}</style>
      </div>
    </Layout>
  );
}
