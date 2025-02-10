import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import '../styles/Navbar.css';
import Sidebar from './Sidebar';

const Navbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Bulk Upload', href: '/bulk-upload' },
    { label: 'Settings', href: '/settings' }
  ];

  const handleLogout = () => {
    setIsDropdownOpen(false);
    toast.success("Logged Out Successfully")
    navigate('/');
  };

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

        {/* Avatar Dropdown */}
        <div className="nav-actions relative">
          <div className="avatar cursor-pointer" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <img src="/placeholder.svg?height=32&width=32" alt="User avatar" />
          </div>

          {isDropdownOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}
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
