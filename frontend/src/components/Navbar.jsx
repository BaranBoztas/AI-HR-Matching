import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Cpu, Bell } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Bildirimler çekilemedi:", err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Bildirim okundu olarak işaretlenemedi:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <Cpu className="logo-icon" size={28} />
          <span className="logo-text">AI-HR Match</span>
        </Link>
        <div className="navbar-actions">
          {token ? (
            <div className="notification-wrapper">
              <div className="bell-icon-container" onClick={() => setShowDropdown(!showDropdown)}>
                <Bell size={24} className="bell-icon" />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </div>
              
              {showDropdown && (
                <div className="notification-dropdown">
                  <div className="notification-header">Bildirimler</div>
                  {notifications.length === 0 ? (
                    <div className="notification-item">Henüz bildiriminiz yok.</div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                      >
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {location.pathname !== '/dashboard' && (
                <Link to="/dashboard" className="btn-signin">Dashboard</Link>
              )}
              <button 
                className="btn-signup" 
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('userRole');
                  navigate('/');
                }}
              >
                Çıkış Yap
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-signin">Giriş Yap</Link>
              <Link to="/signup" className="btn-signup">Kayıt Ol</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
