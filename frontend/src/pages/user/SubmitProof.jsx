import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { toast } from "react-hot-toast";
import api from "../../api/axios";

const MAX_ASSIGN_DISTANCE_M = 20; // change to 50 if you want looser

const fmt = (n) => (Number.isFinite(n) ? n.toFixed(6) : "—");

function toRad(v) {
  return (v * Math.PI) / 180;
}

// Frontend distance calc (meters) - Haversine
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SubmitProof() {
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id"); // string | null
  const isAssignment = !!assignmentId;

  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");

  const [coords, setCoords] = useState(null); // {latitude, longitude, accuracy?}
  const [address, setAddress] = useState("");

  const [assigned, setAssigned] = useState(null); // { spot_id, latitude, longitude, address_text, maps_link }
  const [assignLoading, setAssignLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);

  // previews
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
    }));
    setPreviews(urls);
    return () => urls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);

  // ✅ If assignment mode, fetch assigned spot info (so we can show + precheck distance)
  useEffect(() => {
    let cancelled = false;

    async function loadAssigned() {
      if (!isAssignment) {
        setAssigned(null);
        return;
      }
      setAssignLoading(true);
      try {
        // We don't have a "get single assignment" endpoint, so reuse /user/assignments list:
        const res = await api.get("/user/assignments");
        const list = res.data.assignments || [];
        const found = list.find(
          (a) => String(a.assignment_id) === String(assignmentId)
        );

        if (!cancelled) {
          if (!found) {
            setAssigned(null);
            setMessage("Assignment not found or not active.");
            setMessageType("error");
          } else {
            setAssigned({
              assignment_id: found.assignment_id,
              spot_id: found.spot_id,
              latitude: Number(found.latitude),
              longitude: Number(found.longitude),
              address_text: found.address_text || "",
              maps_link: `https://www.google.com/maps?q=${found.latitude},${found.longitude}`,
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAssigned(null);
          setMessage(e?.response?.data?.message || "Failed to load assignment info");
          setMessageType("error");
        }
      } finally {
        if (!cancelled) setAssignLoading(false);
      }
    }

    loadAssigned();
    return () => {
      cancelled = true;
    };
  }, [isAssignment, assignmentId]);

  // reverse geocode
  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
      },
    });

    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    return data?.display_name || "";
  }

  // ✅ Distance (frontend) when assignment + coords exist
  const assignmentDistanceM = useMemo(() => {
    if (!isAssignment) return null;
    if (!coords || !assigned) return null;

    const d = haversineMeters(
      coords.latitude,
      coords.longitude,
      assigned.latitude,
      assigned.longitude
    );
    return d;
  }, [coords, assigned, isAssignment]);

  const canSubmitAssignment = useMemo(() => {
    if (!isAssignment) return true;
    if (!assigned || assignmentDistanceM == null) return false;
    return assignmentDistanceM <= MAX_ASSIGN_DISTANCE_M;
  }, [isAssignment, assigned, assignmentDistanceM]);

  function captureLocation() {
    setMessage("");
    setAddress("");

    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser");
      setMessageType("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy; // meters

        setCoords({ latitude: lat, longitude: lng, accuracy });

        setMessage("Location captured. Fetching address...");
        setMessageType("info");

        try {
          const addr = await reverseGeocode(lat, lng);
          setAddress(addr || "Address not found");

          // ✅ If assignment mode: show warning if GPS far BEFORE submit
          if (isAssignment && assigned) {
            const d = haversineMeters(lat, lng, assigned.latitude, assigned.longitude);
            if (d > MAX_ASSIGN_DISTANCE_M) {
              setMessage(
                `Location captured, but you seem ~${Math.round(
                  d
                )}m away from the assigned spot. Check GPS / Precise location and try again.`
              );
              setMessageType("error");
            } else {
              setMessage("Location + address captured successfully!");
              setMessageType("success");
            }
          } else {
            setMessage("Location + address captured successfully!");
            setMessageType("success");
          }
        } catch (err) {
          console.error(err);
          setAddress("Unable to fetch address");
          setMessage("Location captured, but address could not be fetched.");
          setMessageType("error");
        }
      },
      () => {
        setMessage("Unable to retrieve your location. Please enable location services.");
        setMessageType("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0, // ✅ avoid cached/old location
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (files.length === 0) {
      toast.error("Please select at least one proof file");
      return;
    }

    if (!coords) {
      toast.error("Please capture your location first");
      return;
    }

    // ✅ Assignment pre-check in frontend
    if (isAssignment) {
      if (!assigned) {
        setMessage("Assignment details not loaded. Go back and open the assignment again.");
        setMessageType("error");
        return;
      }
      if (assignmentDistanceM == null) {
        setMessage("Capture location again to validate distance.");
        setMessageType("error");
        return;
      }
      if (assignmentDistanceM > MAX_ASSIGN_DISTANCE_M) {
        setMessage(
          `You are too far from the assigned location (~${Math.round(
            assignmentDistanceM
          )}m). Move closer and capture location again.`
        );
        setMessageType("error");
        return;
      }
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("proof", file));

    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));
    formData.append("note", note);
    formData.append("address", address || "");

    if (assignmentId) {
      formData.append("assignment_id", assignmentId);
    }

    setLoading(true);
    try {
      const response = await api.post("/user/submissions", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(response.data.message || "Submission successful!");
      setMessage("");

      setFiles([]);
      setPreviews([]);
      setNote("");
      setCoords(null);
      setAddress("");

      const fileInput = document.getElementById("proof-file");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      const data = error?.response?.data;

      // ✅ If backend returns location mismatch details
      if (data?.message && data?.assigned_spot) {
        const d = data?.distance_m;
        setMessage(
          `${data.message}\n\n` +
          `Distance: ${d ? Math.round(d) + "m" : "—"} (allowed ${data.allowed_distance_m || MAX_ASSIGN_DISTANCE_M}m)\n` +
          `Assigned: ${data.assigned_spot.address_text || ""}`
        );
        setMessageType("error");
        return;
      }

      if (data?.message && data?.next_available_date) {
        setMessage(
          `${data.message} Next available date: ${new Date(
            data.next_available_date
          ).toLocaleString()}`
        );
      } else {
        toast.error(data?.message || "Submission failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout role="user">
      <div className="top-bar">
        <div className="top-bar-content">
          <div>
            <h1 className="page-title">Submit Proof</h1>
            <p className="page-subtitle">
              Upload photo or video proof of your poster placement
            </p>
          </div>
        </div>
      </div>

      <div className="content-area">
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <form onSubmit={handleSubmit}>
            <div className="card mb-6">
              <div className="card-header">
                <h3 className="card-title">Submission Form</h3>
                <p className="card-description">
                  Complete all required fields to submit your proof
                </p>
              </div>

              <div className="card-body">
                {/* ✅ Assignment banner */}
                {isAssignment && (
                  <div className="alert alert-info" style={{ marginBottom: 16, whiteSpace: "pre-line" }}>
                    <b>Assignment Mode</b>
                    <div className="text-sm">
                      Assignment ID: {assignmentId}
                    </div>

                    {assignLoading ? (
                      <div className="text-sm">Loading assigned location…</div>
                    ) : assigned ? (
                      <div className="text-sm" style={{ marginTop: 8 }}>
                        <div><b>Spot #{assigned.spot_id}</b></div>
                        <div>{assigned.address_text}</div>
                        <div style={{ marginTop: 8 }}>
                          <a
                            className="btn btn-outline btn-sm"
                            href={assigned.maps_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Assigned Spot Map
                          </a>
                        </div>
                        {coords && assignmentDistanceM != null && (
                          <div style={{ marginTop: 10 }}>
                            <b>Distance to assigned spot:</b>{" "}
                            {Math.round(assignmentDistanceM)}m{" "}
                            {canSubmitAssignment ? (
                              <span className="badge badge-success" style={{ marginLeft: 8 }}>
                                OK
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ marginLeft: 8 }}>
                                TOO FAR
                              </span>
                            )}
                            {Number.isFinite(coords?.accuracy) && (
                              <div className="text-muted" style={{ marginTop: 4 }}>
                                GPS accuracy: ~{Math.round(coords.accuracy)}m (smaller is better)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">No active assignment found.</div>
                    )}
                  </div>
                )}

                {/* File Upload */}
                <div
                  className="mb-6"
                  style={{
                    paddingBottom: "1.5rem",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span style={{ fontSize: "1.5rem" }}>📤</span>
                    <div>
                      <h4 className="font-semibold text-lg">Upload Proof</h4>
                      <p className="text-sm text-muted">
                        Select one or more images or videos
                      </p>
                    </div>
                  </div>

                  <div className="form-group">
                    <input
                      id="proof-file"
                      className="form-input"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    />
                    <p className="form-help">
                      Accepted formats: JPG, PNG, MP4, MOV. You can select multiple files.
                    </p>
                  </div>

                  {previews.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">
                          Previews ({previews.length})
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {previews.map((p, idx) => (
                          <div key={idx} className="preview-container" style={{ position: "relative" }}>
                            {p.type.startsWith("video/") ? (
                              <video controls style={{ width: "100%", borderRadius: "8px" }}>
                                <source src={p.url} />
                              </video>
                            ) : (
                              <img
                                src={p.url}
                                alt={`Preview ${idx}`}
                                style={{
                                  width: "100%",
                                  height: "150px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                }}
                              />
                            )}
                            <div
                              style={{
                                fontSize: "10px",
                                marginTop: "4px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div
                  className="mb-6"
                  style={{
                    paddingBottom: "1.5rem",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span style={{ fontSize: "1.5rem" }}>📍</span>
                    <div>
                      <h4 className="font-semibold text-lg">Location</h4>
                      <p className="text-sm text-muted">
                        Capture your current location + address
                      </p>
                      <p className="text-sm text-muted">
                        Tip: if you test on a laptop, GPS can be wrong. Phone is better.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline btn-block"
                    onClick={captureLocation}
                    disabled={loading}
                  >
                    📍 Capture My Location
                  </button>

                  {coords && (
                    <div className="mt-4">
                      <div className="flex items-center justify-center mb-3">
                        <span className="badge badge-success">✓ Location Captured</span>
                      </div>

                      <div
                        className="card"
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="card-body">
                          <div className="mb-4">
                            <div className="text-sm font-semibold text-muted mb-1">
                              Address
                            </div>
                            <div className="font-semibold" style={{ lineHeight: 1.4 }}>
                              {address ? address : "Fetching address..."}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <div className="text-sm font-semibold text-muted mb-1">
                                Latitude
                              </div>
                              <div className="font-semibold">{fmt(coords.latitude)}</div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-muted mb-1">
                                Longitude
                              </div>
                              <div className="font-semibold">{fmt(coords.longitude)}</div>
                            </div>
                          </div>

                          {Number.isFinite(coords.accuracy) && (
                            <div className="text-sm text-muted mb-3">
                              GPS accuracy: ~{Math.round(coords.accuracy)}m
                            </div>
                          )}

                          <a
                            href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm btn-block"
                          >
                            🗺️ View My GPS on Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span style={{ fontSize: "1.5rem" }}>📝</span>
                    <div>
                      <h4 className="font-semibold text-lg">Additional Notes</h4>
                      <p className="text-sm text-muted">
                        Optional details about this submission
                      </p>
                    </div>
                  </div>

                  <div className="form-group">
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Add any additional information about this poster placement..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block"
                  disabled={
                    loading ||
                    (isAssignment && (!assigned || !coords || !canSubmitAssignment))
                  }
                  title={
                    isAssignment && !canSubmitAssignment
                      ? "You are too far from assigned spot. Capture location again near the spot."
                      : ""
                  }
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      🚀 Submit Proof
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Message Display */}
            {/* Main message display removed in favor of toasts */}

            {/* Notice */}
            <div className="alert alert-warning">
              <span className="alert-icon">⏱️</span>
              <div className="alert-content">
                <div className="alert-title">Cooldown Policy</div>
                The same location (within 20 meters) can only be updated once every 3 months.
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
