import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <Cpu className="logo-icon" size={28} />
          <span className="logo-text">AI-HR Match</span>
        </Link>
        <div className="navbar-actions">
          <Link to="/login" className="btn-signin">Giriş Yap</Link>
          <Link to="/signup" className="btn-signup">Kayıt Ol</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
