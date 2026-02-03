import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";

export default function SubmitProof() {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState(null);

  // ✅ NEW: address state
  const [address, setAddress] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);

  // ✅ preview URLs + cleanup
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    // Create preview URLs when files change
    const urls = files.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name
    }));
    setPreviews(urls);

    // Cleanup URLs on unmount or when files change
    return () => {
      urls.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [files]);

  // ✅ NEW: reverse geocode with Nominatim (FREE, no key)
  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en", // change to "ta" if you want Tamil when available
      },
    });

    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    return data?.display_name || "";
  }

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

        setCoords({ latitude: lat, longitude: lng });

        // show interim status
        setMessage("Location captured. Fetching address...");
        setMessageType("info");

        // fetch address
        try {
          const addr = await reverseGeocode(lat, lng);
          setAddress(addr || "Address not found");
          setMessage("Location + address captured successfully!");
          setMessageType("success");
        } catch (err) {
          console.error(err);
          setAddress("Unable to fetch address");
          setMessage("Location captured, but address could not be fetched.");
          setMessageType("error");
        }
      },
      (error) => {
        setMessage(
          "Unable to retrieve your location. Please enable location services."
        );
        setMessageType("error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (files.length === 0) {
      setMessage("Please select at least one proof file (image or video)");
      setMessageType("error");
      return;
    }

    if (!coords) {
      setMessage("Please capture your location before submitting");
      setMessageType("error");
      return;
    }

    const formData = new FormData();
    // Append each file to the "proof" field
    files.forEach(file => {
      formData.append("proof", file);
    });

    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));
    formData.append("note", note);

    // ✅ NEW (optional): send address to backend too
    formData.append("address", address || "");

    setLoading(true);
    try {
      const response = await api.post("/user/submissions", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage(response.data.message || "Submission successful!");
      setMessageType("success");

      // Reset form
      setFiles([]);
      setNote("");
      setCoords(null);
      setAddress("");

      // Reset file input
      const fileInput = document.getElementById("proof-file");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      const data = error?.response?.data;
      if (data?.message && data?.next_available_date) {
        setMessage(
          `${data.message} Next available date: ${new Date(
            data.next_available_date
          ).toLocaleString()}`
        );
      } else {
        setMessage(data?.message || "Submission failed. Please try again.");
      }
      setMessageType("error");
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
                {/* File Upload Section */}
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
                        <div className="text-sm font-semibold">Previews ({previews.length})</div>
                        {(() => {
                          const hasImage = previews.some(p => p.type.startsWith("image/"));
                          const hasVideo = previews.some(p => p.type.startsWith("video/"));
                          let typeLabel = "";
                          let typeIcon = "";
                          let badgeClass = "";

                          if (hasImage && hasVideo) {
                            typeLabel = "IMAGE and VIDEO";
                            typeIcon = "📷🎬";
                            badgeClass = "badge-info";
                          } else if (hasVideo) {
                            typeLabel = "VIDEOS";
                            typeIcon = "🎬";
                            badgeClass = "badge-secondary";
                          } else {
                            typeLabel = "IMAGE";
                            typeIcon = "📷";
                            badgeClass = "badge-info";
                          }

                          return (
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem' }}>
                              {typeIcon} {typeLabel}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {previews.map((p, idx) => (
                          <div key={idx} className="preview-container" style={{ position: 'relative' }}>
                            {p.type.startsWith("video/") ? (
                              <video controls style={{ width: '100%', borderRadius: '8px' }}>
                                <source src={p.url} />
                              </video>
                            ) : (
                              <img src={p.url} alt={`Preview ${idx}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                            )}
                            <div style={{ fontSize: '10px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


                {/* Location Section */}
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
                        <span className="badge badge-success">
                          ✓ Location Captured
                        </span>
                      </div>

                      <div
                        className="card"
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="card-body">
                          {/* ✅ NEW: Address display */}
                          <div className="mb-4">
                            <div className="text-sm font-semibold text-muted mb-1">
                              Address
                            </div>
                            <div
                              className="font-semibold"
                              style={{ lineHeight: 1.4 }}
                            >
                              {address ? address : "Fetching address..."}
                            </div>
                          </div>

                          {/* Keep lat/lng (optional) */}
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <div className="text-sm font-semibold text-muted mb-1">
                                Latitude
                              </div>
                              <div className="font-semibold">
                                {coords.latitude.toFixed(6)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-muted mb-1">
                                Longitude
                              </div>
                              <div className="font-semibold">
                                {coords.longitude.toFixed(6)}
                              </div>
                            </div>
                          </div>

                          <a
                            href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm btn-block"
                          >
                            🗺️ View on Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Note Section */}
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
                  disabled={loading}
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
            {message && (
              <div className={`alert alert-${messageType}`}>
                <span className="alert-icon">
                  {messageType === "success"
                    ? "✓"
                    : messageType === "error"
                      ? "⚠️"
                      : "ℹ️"}
                </span>
                <div className="alert-content">{message}</div>
              </div>
            )}

            {/* Important Notice */}
            <div className="alert alert-warning">
              <span className="alert-icon">⏱️</span>
              <div className="alert-content">
                <div className="alert-title">Cooldown Policy</div>
                The same location (within 20 meters) can only be updated once
                every 3 months. If a location was recently updated, you'll see
                the next available date.
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
