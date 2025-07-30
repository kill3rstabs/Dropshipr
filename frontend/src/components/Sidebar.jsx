import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Sidebar.css';
import { LayoutDashboard, Upload, Settings } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard /> },
    { label: 'Bulk Upload', href: '/bulk-upload', icon: <Upload /> },
    { label: 'Settings', href: '/settings', icon: <Settings /> }
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
              <div className="flex items-center">
                {item.icon}
                <span className="ml-4">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;