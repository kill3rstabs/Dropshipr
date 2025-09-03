import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import '../styles/Navbar.css';
import Sidebar from './Sidebar';
import { User, Menu, Package } from 'lucide-react';

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
      <nav className="walmart-navbar">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <button 
              className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-white p-2 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AutoEcomm</h1>
                <p className="text-xs text-blue-100">Inventory Management</p>
              </div>
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* User Profile */}
            <div className="relative">
              <button 
                className="flex items-center space-x-3 text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="bg-white/20 p-2 rounded-full">
                  <User className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Afraz Budhwani</p>
                  <p className="text-xs text-blue-100">Inventory Manager</p>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button 
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={handleLogout}
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
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
