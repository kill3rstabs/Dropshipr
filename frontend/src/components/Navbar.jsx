import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';
import Sidebar from './Sidebar';

const Navbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Bulk Upload', href: '/bulk-upload' },
    { label: 'Settings', href: '/settings' }
  ];

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <button 
            className="menu-button"
            onClick={() => setIsSidebarOpen(true)}
          >
            <span className="logo-icon">≡</span>
          </button>
          <Link to="/" className="logo" style={{ paddingLeft: "10px" }}>
            Dropshipr
          </Link>
        </div>

        <div className="nav-links">
          {navItems.map((item, index) => (
            <Link key={index} to={item.href} className="nav-item">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="nav-actions">
          <div className="avatar">
            <img src="/placeholder.svg?height=32&width=32" alt="User avatar" />
          </div>
        </div>
      </nav>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
    </>
  );
};

export default Navbar;