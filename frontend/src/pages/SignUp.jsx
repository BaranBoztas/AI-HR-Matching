import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    role: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 201) {
        navigate("/login");
      } else {
        setError(data.error || "Kayıt işlemi başarısız oldu.");
      }
    } catch (err) {
      console.error("Frontend Hatası:", err);
      setError(
        "Sunucuya bağlanılamadı. Lütfen Node.js terminalini kontrol edin.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Kayıt Ol</h2>
        {error && (
          <div
            style={{
              color: "var(--accent-red)",
              marginBottom: "1rem",
              textAlign: "center",
              fontSize: "0.95rem",
            }}
          >
            {error}
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullname">Ad Soyad</label>
            <input
              type="text"
              id="fullname"
              placeholder="Adınız Soyadınız"
              required
              value={formData.fullname}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">E-posta</label>
            <input
              type="email"
              id="email"
              placeholder="ornek@sirket.com"
              required
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="role">Hesap Türü</label>
            <select
              id="role"
              required
              value={formData.role}
              onChange={handleChange}
            >
              <option value="" disabled>
                Lütfen seçin...
              </option>
              <option value="candidate">Aday (Candidate)</option>
              <option value="company">Şirket (Company)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Kayıt Olunuyor..." : "Kayıt Ol"}
          </button>
        </form>
        <div className="auth-footer">
          Zaten hesabınız var mı?{" "}
          <Link to="/login" className="auth-link">
            Giriş Yap
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
