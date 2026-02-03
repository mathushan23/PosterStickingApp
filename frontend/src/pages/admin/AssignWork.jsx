import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16);
  }, [position, map]);
  return null;
}

export default function AssignWork() {
  const [users, setUsers] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [location, setLocation] = useState(null); // {lat,lng,address}
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/admin/users").then((r) => setUsers(r.data.users || []));
  }, []);

  // --- USER AUTOCOMPLETE ---
  const filteredUsers = useMemo(() => {
    const q = userQ.toLowerCase();
    return users
      .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [userQ, users]);

  // --- LOCATION AUTOSUGGEST (OSM NOMINATIM) ---
  async function searchLocation(q) {
    if (!q || q.length < 3) {
      setSuggestions([]);
      return;
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}`
    );
    const data = await res.json();
    setSuggestions(data.slice(0, 6));
  }

  function selectSuggestion(s) {
    const loc = {
      lat: Number(s.lat),
      lng: Number(s.lon),
      address: s.display_name,
    };
    setLocation(loc);
    setSearchQ(s.display_name);
    setSuggestions([]);
  }

  async function assignNow() {
    setErr("");
    setOk("");

    if (!selectedUser) {
      setErr("Select a user");
      return;
    }
    if (!location) {
      setErr("Select a location from map or search");
      return;
    }

    setLoading(true);
    try {
      // ✅ 1. CHECK AVAILABILITY FIRST
      const check = await api.post("/admin/spots/check", {
        latitude: location.lat,
        longitude: location.lng,
      });

      let spotId;

      // ✅ If nearby spot exists and reusable
      if (check.data.existing_spot_id) {
        spotId = check.data.existing_spot_id;
      } else {
        // ✅ Create new spot
        const spotRes = await api.post("/admin/spots", {
          latitude: location.lat,
          longitude: location.lng,
          address_text: location.address,
        });
        spotId = spotRes.data.spot.id;
      }

      // ✅ Assign
      await api.post("/admin/spot-assignments", {
        spot_id: spotId,
        user_id: selectedUser.id,
      });

      setOk(`Assigned successfully to ${selectedUser.name}`);
      setLocation(null);
      setSearchQ("");
      setSelectedUser(null);
      setUserQ("");
    } catch (e) {
      if (e?.response?.status === 409) {
        const next = e.response.data.next_available_date;
        setErr(
          next
            ? `This location is already used. Available on ${new Date(next).toLocaleDateString()}`
            : e.response.data.message
        );
      } else {
        setErr(e?.response?.data?.message || "Assignment failed");
      }
    } finally {
      setLoading(false);
    }
  }


  return (
    <Layout
      role="admin"
      title="Assign Poster Work"
      subtitle="Select user and choose real location using map"
      userLabel="Admin"
    >
      {err && <div className="alert alert-error">{err}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}

      <div className="card p-6">
        {/* USER */}
        <div className="form-group">
          <label className="form-label">User</label>
          <input
            className="form-input"
            placeholder="Search user..."
            value={userQ}
            onChange={(e) => {
              setUserQ(e.target.value);
              setSelectedUser(null);
            }}
          />
          {userQ && !selectedUser && (
            <div className="dropdown">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedUser(u);
                    setUserQ(`${u.name} (${u.email})`);
                  }}
                >
                  {u.name} — {u.email}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOCATION SEARCH */}
        <div className="form-group">
          <label className="form-label">Location</label>
          <input
            className="form-input"
            placeholder="Search place / address..."
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              searchLocation(e.target.value);
            }}
          />
          {suggestions.length > 0 && (
            <div className="dropdown">
              {suggestions.map((s) => (
                <div
                  key={s.place_id}
                  className="dropdown-item"
                  onClick={() => selectSuggestion(s)}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MAP */}
        <div style={{ height: 420, borderRadius: 12, overflow: "hidden" }}>
          <MapContainer
            center={[7.8731, 80.7718]} // Sri Lanka default
            zoom={8}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(map) => {
              map.on("click", async (e) => {
                const { lat, lng } = e.latlng;
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
                );
                const data = await res.json();
                setLocation({
                  lat,
                  lng,
                  address: data.display_name,
                });
                setSearchQ(data.display_name);
              });
            }}
          >
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {location && (
              <>
                <Marker position={[location.lat, location.lng]} />
                <FlyTo position={[location.lat, location.lng]} />
              </>
            )}
          </MapContainer>
        </div>

        {/* SUMMARY */}
        {location && (
          <div className="mt-4 text-sm">
            <b>Selected Address:</b>
            <div className="text-muted">{location.address}</div>
          </div>
        )}

        <button
          className="btn btn-primary btn-block mt-6"
          disabled={loading}
          onClick={assignNow}
        >
          {loading ? "Assigning..." : "Assign Work"}
        </button>
      </div>
    </Layout>
  );
}
