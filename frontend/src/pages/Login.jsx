import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user?.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/user/dashboard");
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Login failed. Please check your credentials.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📋</div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to access your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

<div className="form-group">
  <label className="form-label">Password</label>

  <div className="password-field">
    <input
      className="form-input"
      type={showPassword ? "text" : "password"}
      placeholder="Enter your password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
      autoComplete="current-password"
    />

    <button
      type="button"
      className="password-eye"
      onClick={() => setShowPassword((p) => !p)}
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {/* eye icon (SVG) */}
      {showPassword ? (
        /* eye-off */
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M2.1 3.5 3.5 2.1 21.9 20.5 20.5 21.9l-2.2-2.2A11.6 11.6 0 0 1 12 21C5 21 1 12 1 12a21 21 0 0 1 5.2-6.6L2.1 3.5ZM12 7c3.9 0 7.2 2.2 9 5a19.7 19.7 0 0 1-3.8 4.6l-2-2A3.9 3.9 0 0 0 12 8.1l-2-2A10.8 10.8 0 0 1 12 7Zm0 4a1.9 1.9 0 0 1 1.9 1.9c0 .2 0 .4-.1.6l-2.4-2.4.6-.1Zm-6.9 1c1.1 2 3.5 5 6.9 5 1 0 1.9-.2 2.7-.5l-1.3-1.3a3.9 3.9 0 0 1-5-5L6.2 8A19.7 19.7 0 0 0 3 12Z"
          />
        </svg>
      ) : (
        /* eye */
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7Zm0 2c-4.9 0-8.2 4.1-9 5a12 12 0 0 0 18 0c-.8-.9-4.1-5-9-5Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"
          />
        </svg>
      )}
    </button>
  </div>
</div>


          {/* error box removed since we use toasts */}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
