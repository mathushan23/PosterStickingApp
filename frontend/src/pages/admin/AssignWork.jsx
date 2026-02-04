import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.7 });
  }, [position, map]);
  return null;
}

export default function AssignWork() {
  const [users, setUsers] = useState([]);

  // ✅ user picker
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOpen, setUserOpen] = useState(false);

  // ✅ location picker
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState(null); // {lat,lng,address, source}
  const [locLoading, setLocLoading] = useState(false);

  // ui
  const [loading, setLoading] = useState(false);

  const userBoxRef = useRef(null);

  useEffect(() => {
    api.get("/admin/users").then((r) => setUsers(r.data.users || []));
  }, []);

  // close user dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (userBoxRef.current && !userBoxRef.current.contains(e.target)) {
        setUserOpen(false);
      }
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ✅ only "user" role (hide admins)
  const visibleUsers = useMemo(() => {
    return (users || []).filter((u) => String(u.role || "").toLowerCase() !== "admin");
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return visibleUsers.slice(0, 8);
    return visibleUsers
      .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [userQuery, visibleUsers]);

  // ✅ debounced location search
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
            q
          )}`,
          { headers: { Accept: "application/json", "Accept-Language": "en" } }
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch {
        setSuggestions([]);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [searchQ]);

  async function reverseGeocode(lat, lng) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}`,
      { headers: { Accept: "application/json", "Accept-Language": "en" } }
    );
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    return data?.display_name || "";
  }

  function selectSuggestion(s) {
    const loc = {
      lat: Number(s.lat),
      lng: Number(s.lon),
      address: s.display_name,
      source: "search",
    };
    setLocation(loc);
    setSearchQ(s.display_name);
    setSuggestions([]);
  }

  async function pickFromMap(lat, lng) {
    setLocLoading(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      setLocation({
        lat,
        lng,
        address: addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: "map",
      });
      setSearchQ(addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setSuggestions([]);
    } catch {
      setLocation({
        lat,
        lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: "map",
      });
      setSearchQ(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setSuggestions([]);
    } finally {
      setLocLoading(false);
    }
  }

  async function useCurrentLocation() {
    setLocLoading(true);

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported in your browser.");
      setLocLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        await pickFromMap(lat, lng);
        setLocLoading(false);
      },
      () => {
        toast.error("Unable to get current location. Please allow location permission.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  async function assignNow() {
    if (!selectedUser) {
      toast.error("Please select a user from the list.");
      return;
    }
    if (!location) {
      toast.error("Please select a location.");
      return;
    }

    setLoading(true);
    try {
      // 1) check cooldown availability
      const check = await api.post("/admin/spots/check", {
        latitude: location.lat,
        longitude: location.lng,
      });

      let spotId;
      if (check.data.existing_spot_id) {
        spotId = check.data.existing_spot_id;
      } else {
        const spotRes = await api.post("/admin/spots", {
          latitude: location.lat,
          longitude: location.lng,
          address_text: location.address,
        });
        spotId = spotRes.data.spot.id;
      }

      // 2) assign
      await api.post("/admin/spot-assignments", {
        spot_id: spotId,
        user_id: selectedUser.id,
      });

      toast.success(`Assigned successfully to ${selectedUser.name}`);
      setLocation(null);
      setSearchQ("");
      setSelectedUser(null);
      setUserQuery("");
      setUserOpen(false);
    } catch (e) {
      if (e?.response?.status === 409) {
        const next = e.response.data.next_available_date;
        toast.error(
          next
            ? `Location in cooldown. Available on ${new Date(next).toLocaleString()}`
            : e.response.data.message
        );
      } else {
        toast.error(e?.response?.data?.message || "Assignment failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const mapCenter = location ? [location.lat, location.lng] : [7.8731, 80.7718];

  return (
    <Layout
      role="admin"
      title="Assign Poster Work"
      subtitle="Pick a user, choose a real location, then assign"
      userLabel="Admin"
    >
      {/* alerts removed */}

      <div className="card p-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="card-title">Assignment Details</div>
            <div className="text-sm text-muted">
              Select user + location (search / map / current)
            </div>
          </div>
          {(loading || locLoading) && <span className="badge badge-secondary">Working...</span>}
        </div>

        {/* USER PICKER */}
        <div className="form-group" ref={userBoxRef}>
          <label className="form-label">User (only role: user)</label>

          {selectedUser ? (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <div className="font-semibold">{selectedUser.name}</div>
                <div className="text-sm text-muted">{selectedUser.email}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedUser(null);
                  setUserQuery("");
                  setUserOpen(true);
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="form-input"
                placeholder="Search by name or email..."
                value={userQuery}
                onFocus={() => setUserOpen(true)}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setUserOpen(true);
                }}
              />

              {userOpen && (
                <div className="dropdown" style={{ maxHeight: 260, overflow: "auto" }}>
                  {filteredUsers.length === 0 ? (
                    <div className="dropdown-item text-muted">No users found</div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="dropdown-item"
                        onClick={() => {
                          setSelectedUser(u);
                          setUserOpen(false);
                          setUserQuery("");
                        }}
                      >
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-sm text-muted">{u.email}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* LOCATION SEARCH */}
        <div className="form-group">
          <label className="form-label">Location</label>

          <div className="flex gap-2">
            <input
              className="form-input"
              placeholder="Search place / address (min 3 letters)..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={useCurrentLocation}
              disabled={locLoading}
              title="Use your current GPS location"
            >
              📍 Current
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="dropdown" style={{ maxHeight: 260, overflow: "auto" }}>
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

          {/* ✅ MAP UNDER LOCATION SEARCH */}
          <div className="mt-4" style={{ height: 420, borderRadius: 12, overflow: "hidden" }}>
            <MapContainer
              center={mapCenter}
              zoom={location ? 16 : 8}
              style={{ height: "100%", width: "100%" }}
              whenCreated={(map) => {
                map.on("click", async (e) => {
                  const { lat, lng } = e.latlng;
                  await pickFromMap(lat, lng);
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

          {/* Selected location info */}
          {location && (
            <div className="mt-3 p-3 rounded-lg border" style={{ background: "var(--bg)" }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Selected Address</div>
                <span className="badge badge-info">
                  {location.source === "search" ? "Search" : location.source === "map" ? "Map" : "GPS"}
                </span>
              </div>
              <div className="text-sm text-muted mt-1">{location.address}</div>
              <div className="text-xs text-muted mt-2">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  className="btn btn-ghost btn-sm"
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  🗺️ Open Map
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setLocation(null);
                    setSearchQ("");
                    setSuggestions([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-primary btn-block mt-4"
          disabled={loading || locLoading}
          onClick={assignNow}
        >
          {loading ? "Assigning..." : "Assign Work"}
        </button>

        <div className="alert alert-warning mt-4">
          <span className="alert-icon">⏱️</span>
          <div className="alert-content">
            <div className="alert-title">Cooldown Policy</div>
            Spots within <b>20 meters</b> can’t be reused until the <b>3 months</b> cooldown ends.
          </div>
        </div>
      </div>
    </Layout>
  );
}
