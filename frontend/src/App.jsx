import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import { ToastContainer } from "react-toastify";
import Navbar from "./components/Navbar";
import ProductMappingTable from "./components/ProductMappingTableComponent";
import "react-toastify/dist/ReactToastify.css";
import StoreListingPage from "./components/settings";
import AuthPage from "./components/AuthComponent";
import MultiStepForm from "./components/MultiStepForm";

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
    <div className="min-h-screen bg-walmart-gray">
      {!isAuthPage && <Navbar />}
      <main className={`${!isAuthPage ? 'pt-0' : ''}`}>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bulk-upload" element={<ProductMappingTable />} />
          <Route path="/settings" element={<StoreListingPage />} />
          <Route path="/create-store" element={<MultiStepForm />} />
        </Routes>
      </main>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        toastClassName="walmart-toast"
        progressClassName="walmart-progress"
      />
    </div>
  );
}

export default App;
