import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import '../styles/Navbar.css';
import Sidebar from './Sidebar';
import { Search, User } from 'lucide-react';

const Navbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    // { label: 'Dashboard', href: '/dashboard' },
    // { label: 'Bulk Upload', href: '/bulk-upload' },
    // { label: 'Settings', href: '/settings' }
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

        <div className="flex-grow mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="w-full py-2 pl-10 pr-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Avatar Dropdown */}
        <div className="nav-actions relative">
          <div className="cursor-pointer" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <User className="text-white bg-gray-700 rounded-full p-1" size={32} />
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
