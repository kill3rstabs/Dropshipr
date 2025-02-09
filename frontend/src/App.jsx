import { HashRouter , Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import ProductMappingTable from './components/ProductMappingTableComponent';
import 'react-toastify/dist/ReactToastify.css';
import SettingsLayout from './components/settings';

function App() {
  return (
    <HashRouter >
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bulk-upload" element={<ProductMappingTable />} />
            <Route path="/settings" element={<SettingsLayout />} />
          </Routes>
        </main>
      </div>
    </HashRouter >
  );
}

export default App;