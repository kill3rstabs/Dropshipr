import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";  // Import useNavigate
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { toast } from "react-toastify";

// Fallback initial stores if localStorage is empty
const initialStores = [
  { id: 1, name: "Tech Gadgets Store", marketplace: "Amazon", active: true },
  { id: 2, name: "Fashion Outlet", marketplace: "Shopify", active: true },
  { id: 3, name: "Home Essentials", marketplace: "eBay", active: true },
  { id: 4, name: "Organic Foods", marketplace: "Etsy", active: false },
];

export default function StoreListingPage() {
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();  // Initialize the navigate function

  // Fetch stores from localStorage on component mount
  useEffect(() => {
    const storedStores = JSON.parse(localStorage.getItem('stores') || '[]');
    // If no stores in localStorage yet, use initialStores
    if (storedStores.length === 0) {
      setStores(initialStores);
      localStorage.setItem('stores', JSON.stringify(initialStores));
    } else {
      setStores(storedStores);
    }
  }, []);

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (store.storeInfo?.storeName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleToggleActive = (id) => {
    const updatedStores = stores.map((store) => 
      store.id === id ? { ...store, active: !store.active } : store
    );
    setStores(updatedStores);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
  };

  const handleEditStore = (store) => {
    navigate("/create-store", { state: { storeData: store } });
  };

  const handleDeleteStore = (id) => {
    const updatedStores = stores.filter(store => store.id !== id);
    setStores(updatedStores);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
    toast.success("Store deleted successfully");
  };

  // Function to get the store name
  const getStoreName = (store) => {
    return store.name || store.storeInfo?.storeName || "Unnamed Store";
  };

  // Function to get the marketplace
  const getMarketplace = (store) => {
    if (store.marketplace) return store.marketplace;
    
    if (store.storeInfo?.marketplace) {
      // Handle marketplace that is stored as an ID
      const marketplaceId = store.storeInfo.marketplace;
      const marketplaces = {
        "amazon": "Amazon",
        "ebay": "eBay",
        "etsy": "Etsy",
        "shopify": "Shopify",
        "walmart": "Walmart",
        "flipkart": "Flipkart",
        "meesho": "Meesho"
      };
      return marketplaces[marketplaceId] || marketplaceId;
    }
    
    return "Unknown";
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Stores</h1>

      <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
        <div className="relative w-full sm:max-w-xs">
          <label className="text-sm text-muted-foreground mb-1 block">Search by Name</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Use navigate() to go to /create-store route */}
        <Button className="self-end" onClick={() => navigate("/create-store")}>
          <Plus className="mr-2 h-4 w-4" />
          NEW
        </Button>
      </div>

      <div className="border rounded-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Store Name</TableHead>
              <TableHead className="px-4">Marketplace</TableHead>
              <TableHead className="px-4">Active</TableHead>
              <TableHead className="px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStores.length > 0 ? (
              filteredStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium py-4 px-4">{getStoreName(store)}</TableCell>
                  <TableCell className="py-4 px-4">{getMarketplace(store)}</TableCell>
                  <TableCell className="py-4 px-4">
                    <Switch checked={store.active} onCheckedChange={() => handleToggleActive(store.id)} />
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <div className="flex gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditStore(store)}
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDeleteStore(store.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No stores found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
