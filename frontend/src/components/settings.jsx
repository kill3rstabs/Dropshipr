import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { toast } from "react-toastify";
import { marketplaceAPI, transformStoreDataForFrontend } from "../services/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export default function StoreListingPage() {
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketplaces, setMarketplaces] = useState([]);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateForm, setDuplicateForm] = useState({ name: "", marketplace: "" });
  const [storeToDuplicate, setStoreToDuplicate] = useState(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());
  const navigate = useNavigate();

  // Fetch stores and marketplaces on mount
  useEffect(() => {
    fetchStores();
    fetchMarketplaces();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const storesData = await marketplaceAPI.getStores({ active_only: false });
      const transformedStores = storesData.map(transformStoreDataForFrontend);
      setStores(transformedStores);
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to load stores');
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplaces = async () => {
    try {
      const mps = await marketplaceAPI.getMarketplaces();
      setMarketplaces(mps || []);
    } catch (e) {
      console.error('Error fetching marketplaces:', e);
    }
  };

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (store.storeInfo?.storeName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleToggleActive = async (id, nextActive) => {
    // mark as toggling
    setTogglingIds(prev => new Set([...prev, id]));
    try {
      const updated = await marketplaceAPI.setStoreActive(id, nextActive);
      const updatedStore = transformStoreDataForFrontend(updated);
      const updatedStores = stores.map((s) => s.id === id ? updatedStore : s);
      setStores(updatedStores);
      toast.success(`Store ${updatedStore.is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error('Error updating store:', err);
      toast.error('Failed to update store status');
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleEditStore = async (store) => {
    try {
      const full = await marketplaceAPI.getStore(store.id);
      const transformed = transformStoreDataForFrontend(full);
      navigate("/create-store", { state: { storeData: transformed } });
    } catch (e) {
      console.error('Error loading store details:', e);
      toast.error('Failed to load store details');
    }
  };

  const handleDeleteStore = async (id) => {
    setDeletingIds(prev => new Set([...prev, id]));
    try {
      await marketplaceAPI.deleteStore(id);
      const updatedStores = stores.filter(store => store.id !== id);
      setStores(updatedStores);
      toast.success("Store deleted successfully");
    } catch (err) {
      console.error('Error deleting store:', err);
      toast.error('Failed to delete store');
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const openDuplicateModal = (store) => {
    setStoreToDuplicate(store);
    setDuplicateForm({ name: `${store.name} Copy`, marketplace: store.marketplace_id?.toString?.() || "" });
    setDuplicateModalOpen(true);
  };

  const submitDuplicate = async () => {
    if (!storeToDuplicate) return;
    if (!duplicateForm.name || !duplicateForm.marketplace) {
      toast.error('Please provide name and marketplace');
      return;
    }
    setDupLoading(true);
    try {
      const payload = {
        name: duplicateForm.name,
        marketplace_id: parseInt(duplicateForm.marketplace),
        api_key_enc: storeToDuplicate.storeInfo?.apiKey || "",
      };
      const newStore = await marketplaceAPI.duplicateStore(storeToDuplicate.id, payload);
      const transformed = transformStoreDataForFrontend(newStore);
      setStores(prev => [transformed, ...prev]);
      toast.success('Store duplicated successfully');
      setDuplicateModalOpen(false);
      setStoreToDuplicate(null);
    } catch (e) {
      console.error('Error duplicating store:', e);
      toast.error('Failed to duplicate store');
    } finally {
      setDupLoading(false);
    }
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

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading stores...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">{error}</div>
        </div>
      </div>
    );
  }

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
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={store.is_active}
                        onCheckedChange={(checked) => handleToggleActive(store.id, checked)}
                        disabled={togglingIds.has(store.id) || deletingIds.has(store.id)}
                      />
                      {(togglingIds.has(store.id)) && (
                        <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <div className="flex gap-3 items-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditStore(store)}
                        disabled={togglingIds.has(store.id) || deletingIds.has(store.id)}
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDeleteStore(store.id)}
                        disabled={togglingIds.has(store.id) || deletingIds.has(store.id)}
                      >
                        {deletingIds.has(store.id) ? (
                          <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="h-4 w-4 text-red-500" />
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => openDuplicateModal(store)}
                        disabled={togglingIds.has(store.id) || deletingIds.has(store.id)}
                      >
                        Duplicate
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

      {duplicateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-md p-6 w-full max-w-md space-y-4 shadow-lg">
            <h2 className="text-xl font-semibold">Duplicate Store</h2>
            <div className="space-y-2">
              <label className="text-sm">New Store Name</label>
              <Input 
                value={duplicateForm.name}
                onChange={(e) => setDuplicateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter new store name"
                disabled={dupLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Marketplace</label>
              <Select 
                value={duplicateForm.marketplace}
                onValueChange={(v) => setDuplicateForm(prev => ({ ...prev, marketplace: v }))}
                disabled={dupLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select marketplace" />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.map(mp => (
                    <SelectItem key={mp.id} value={mp.id.toString()}>{mp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDuplicateModalOpen(false)} disabled={dupLoading}>Cancel</Button>
              <Button onClick={submitDuplicate} disabled={dupLoading}>
                {dupLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Duplicating...
                  </span>
                ) : 'Duplicate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
