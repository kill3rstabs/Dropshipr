import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/Navbar";
import ProductMappingTable from "./components/ProductMappingTableComponent";
import "react-toastify/dist/ReactToastify.css";
import SettingsLayout from "./components/settings";
import AuthPage from "./components/AuthComponent";

function App() {
  return (
    <HashRouter>
      <MainLayout />
    </HashRouter>
  );
}

function MainLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-white">
      {!isAuthPage && <Navbar />} {/* 👈 Hide Navbar on Auth Page */}
      <main className="container mx-auto py-6">
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bulk-upload" element={<ProductMappingTable />} />
          <Route path="/settings" element={<SettingsLayout />} />
        </Routes>
      </main>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
      />
    </div>
  );
}

export default App;
