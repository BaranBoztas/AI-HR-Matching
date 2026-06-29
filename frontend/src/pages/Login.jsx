import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 200) {
        localStorage.setItem('token', data.token);
        if (data.user && data.user.role) {
          localStorage.setItem('userRole', data.user.role);
        }
        navigate('/dashboard');
      } else {
        setError(data.error || data.message || 'Hatalı e-posta veya şifre.');
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Giriş Yap</h2>
        {error && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.95rem' }}>{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
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
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <div className="auth-footer">
          Hesabınız yok mu? <Link to="/signup" className="auth-link">Kayıt Ol</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
