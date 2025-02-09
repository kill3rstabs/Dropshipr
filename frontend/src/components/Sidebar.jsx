import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Bulk Upload', href: '/bulk-upload' },
    { label: 'Settings', href: '/settings' }
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`} 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo">
            <span className="logo-icon">≡</span>
            Dropshipr
          </Link>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <Link 
              key={index} 
              to={item.href} 
              className="sidebar-nav-item"
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;