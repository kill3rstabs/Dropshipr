"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Copy } from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { marketplaceAPI, transformStoreDataForAPI } from "../services/api";

function sortRanges(ranges){return [...ranges].sort((a,b)=> (parseFloat(a.from||0)-parseFloat(b.from||0)))}
function rangesAreContiguous(ranges){
  if(!ranges.length) return true;
  const sr = sortRanges(ranges);
  const start = parseFloat(sr[0].from || 0);
  if(!Number.isFinite(start) || start !== 0) return false;
  for(let i=0;i<sr.length-1;i++){
    const a = parseFloat(sr[i].to);
    const b = parseFloat(sr[i+1].from);
    if(!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a-b) > 1e-9) return false;
  }
  const lastTo = String(sr[sr.length-1].to || "MAX").trim().toUpperCase();
  return lastTo === "MAX";
}

export default function CreateStoreForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState("store-info");
  const [isEditMode, setIsEditMode] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marketplaces, setMarketplaces] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Store Information State
  const [storeInfo, setStoreInfo] = useState({
    storeName: "",
    marketplace: "",
    apiKey: "",
  });

  // Vendor-scoped arrays
  const [priceSettingsByVendor, setPriceSettingsByVendor] = useState([]);
  const [inventorySettingsByVendor, setInventorySettingsByVendor] = useState([]);
  const [pricePendingVendor, setPricePendingVendor] = useState("");
  const [inventoryPendingVendor, setInventoryPendingVendor] = useState("");
  // Duplicate modal state
  const [duplicateModal, setDuplicateModal] = useState({ open: false, type: null, fromVendorId: "", toVendorId: "", copyFees: true });

  // Fetch marketplaces and vendors
  useEffect(() => { fetchMarketplaces(); fetchVendors(); }, []);

  const fetchMarketplaces = async () => {
    try { const marketplacesData = await marketplaceAPI.getMarketplaces(); setMarketplaces(marketplacesData);} catch (err) { console.error('Error fetching marketplaces:', err); toast.error('Failed to load marketplaces'); }
  };
  const fetchVendors = async () => {
    try { const list = await marketplaceAPI.getVendors(); setVendors(list||[]);} catch (err) { console.error('Error fetching vendors:', err); toast.error('Failed to load vendors'); }
  };

  // Check if we're in edit mode
  useEffect(() => {
    if (location.state && location.state.storeData) {
      const { id, storeInfo: editStoreInfo, priceSettingsByVendor: ps, inventorySettingsByVendor: is } = location.state.storeData;
      setIsEditMode(true);
      setStoreId(id);
      if (editStoreInfo) setStoreInfo(editStoreInfo);
      if (ps) setPriceSettingsByVendor(ps);
      if (is) setInventorySettingsByVendor(is);
    }
  }, [location.state]);

  // Store Info Handlers
  const updateStoreInfo = (field, value) => {
    setStoreInfo((prev) => ({ ...prev, [field]: value }));
  };

  // Price tab vendor helpers
  const usedPriceVendors = useMemo(()=> new Set(priceSettingsByVendor.map(v=>v.vendorId)), [priceSettingsByVendor]);
  const availablePriceVendors = useMemo(()=> vendors.filter(v=> !usedPriceVendors.has(v.id)), [vendors, usedPriceVendors]);
  const addPriceVendor = () => {
    if(!pricePendingVendor) { toast.error('Select a vendor'); return; }
    const vid = parseInt(pricePendingVendor);
    if (usedPriceVendors.has(vid)) { toast.error('Vendor already added'); return; }
    setPriceSettingsByVendor(prev => ([...prev, { vendorId: vid, purchaseTax: "", marketplaceFees: "", priceRanges: [{ from: "0", to: "MAX", margin: "", minimumMargin: "" }] }]));
    setPricePendingVendor("");
  };
  const removePriceVendor = (vendorId) => setPriceSettingsByVendor(prev=> prev.filter(v=> v.vendorId!==vendorId));
  const updatePriceVendorField = (vendorId, field, value) => setPriceSettingsByVendor(prev => prev.map(v=> v.vendorId===vendorId ? { ...v, [field]: value.replace(/[^0-9.]/g, "") } : v));
  const addPriceRange = (vendorId) => setPriceSettingsByVendor(prev => prev.map(v=>{ if(v.vendorId!==vendorId) return v; const ranges=[...v.priceRanges]; const last= ranges[ranges.length-1]; const from = last.from || "0"; const to = (parseFloat(from||0)+100).toString(); ranges[ranges.length-1] = { ...last, to }; ranges.push({ from: to, to: "MAX", margin: "", minimumMargin: ""}); return { ...v, priceRanges: ranges }; }));
  const updatePriceRange = (vendorId, idx, field, value) => setPriceSettingsByVendor(prev => prev.map(v=> v.vendorId===vendorId ? { ...v, priceRanges: v.priceRanges.map((r,i)=> i===idx ? { ...r, [field]: field==='to'? value.replace(/[^0-9.]/g, ""): value.replace(/[^0-9.]/g, "") } : r) } : v));
  const removePriceRangeRow = (vendorId, idx) => setPriceSettingsByVendor(prev => prev.map(v => {
    if (v.vendorId !== vendorId) return v;
    let ranges = v.priceRanges.filter((_, i) => i !== idx);
    if (!ranges.length) {
      ranges = [{ from: "0", to: "MAX", margin: "", minimumMargin: "" }];
    } else {
      ranges[ranges.length - 1] = { ...ranges[ranges.length - 1], to: "MAX" };
    }
    return { ...v, priceRanges: ranges };
  }));

  // Inventory tab vendor helpers
  const usedInventoryVendors = useMemo(()=> new Set(inventorySettingsByVendor.map(v=>v.vendorId)), [inventorySettingsByVendor]);
  const availableInventoryVendors = useMemo(()=> vendors.filter(v=> !usedInventoryVendors.has(v.id)), [vendors, usedInventoryVendors]);
  const addInventoryVendor = () => {
    if(!inventoryPendingVendor) { toast.error('Select a vendor'); return; }
    const vid = parseInt(inventoryPendingVendor);
    if (usedInventoryVendors.has(vid)) { toast.error('Vendor already added'); return; }
    setInventorySettingsByVendor(prev => ([...prev, { vendorId: vid, priceRanges: [{ from: "0", to: "MAX", multipliedWith: "" }] }]));
    setInventoryPendingVendor("");
  };
  const removeInventoryVendor = (vendorId) => setInventorySettingsByVendor(prev=> prev.filter(v=> v.vendorId!==vendorId));
  const addInventoryRange = (vendorId) => setInventorySettingsByVendor(prev => prev.map(v=>{ if(v.vendorId!==vendorId) return v; const ranges=[...v.priceRanges]; const last=ranges[ranges.length-1]; const from= last.from || "0"; const to=(parseFloat(from||0)+100).toString(); ranges[ranges.length-1]={...last, to}; ranges.push({ from: to, to: "MAX", multipliedWith: ""}); return { ...v, priceRanges: ranges }; }));
  const updateInventoryRange = (vendorId, idx, field, value) => setInventorySettingsByVendor(prev => prev.map(v=> v.vendorId===vendorId ? { ...v, priceRanges: v.priceRanges.map((r,i)=> i===idx ? { ...r, [field]: value.replace(/[^0-9.]/g, "") } : r)} : v));
  const removeInventoryRangeRow = (vendorId, idx) => setInventorySettingsByVendor(prev => prev.map(v => {
    if (v.vendorId !== vendorId) return v;
    let ranges = v.priceRanges.filter((_, i) => i !== idx);
    if (!ranges.length) {
      ranges = [{ from: "0", to: "MAX", multipliedWith: "" }];
    } else {
      ranges[ranges.length - 1] = { ...ranges[ranges.length - 1], to: "MAX" };
    }
    return { ...v, priceRanges: ranges };
  }));

  // Duplicate handlers
  const openDuplicateModal = (type) => {
    if (type === 'price' && priceSettingsByVendor.length === 0) { toast.error('Add at least one vendor in Price Settings first'); return; }
    if (type === 'inventory' && inventorySettingsByVendor.length === 0) { toast.error('Add at least one vendor in Inventory Settings first'); return; }
    setDuplicateModal({ open: true, type, fromVendorId: "", toVendorId: "", copyFees: true });
  };
  const closeDuplicateModal = () => setDuplicateModal(prev => ({ ...prev, open: false }));
  const applyDuplicate = () => {
    const fromId = parseInt(duplicateModal.fromVendorId);
    const toId = parseInt(duplicateModal.toVendorId);
    if (!Number.isFinite(fromId) || !Number.isFinite(toId)) { toast.error('Select source and target vendors'); return; }
    if (!vendors.find(v=>v.id===toId)) { toast.error('Invalid target vendor'); return; }

    if (duplicateModal.type === 'price') {
      const source = priceSettingsByVendor.find(v=> v.vendorId===fromId);
      if (!source) { toast.error('Source vendor not found in Price Settings'); return; }
      const rangesCopy = (source.priceRanges||[]).map(r=> ({ from: String(r.from||"0"), to: String((r.to||"MAX")).toUpperCase()==='MAX'? 'MAX' : String(r.to), margin: String(r.margin||""), minimumMargin: String(r.minimumMargin||"") }));
      setPriceSettingsByVendor(prev => {
        const existsIdx = prev.findIndex(v=> v.vendorId===toId);
        if (existsIdx !== -1) {
          const proceed = window.confirm('Target vendor already has Price Settings. Overwrite them?');
          if (!proceed) return prev;
          const updated = [...prev];
          updated[existsIdx] = { ...updated[existsIdx], priceRanges: rangesCopy, ...(duplicateModal.copyFees ? { purchaseTax: source.purchaseTax||"", marketplaceFees: source.marketplaceFees||"" } : {}) };
          return updated;
        }
        const newEntry = { vendorId: toId, purchaseTax: duplicateModal.copyFees ? (source.purchaseTax||"") : "", marketplaceFees: duplicateModal.copyFees ? (source.marketplaceFees||"") : "", priceRanges: rangesCopy };
        return [...prev, newEntry];
      });
      toast.success('Price settings duplicated');
      closeDuplicateModal();
      return;
    }

    if (duplicateModal.type === 'inventory') {
      const source = inventorySettingsByVendor.find(v=> v.vendorId===fromId);
      if (!source) { toast.error('Source vendor not found in Inventory Settings'); return; }
      const rangesCopy = (source.priceRanges||[]).map(r=> ({ from: String(r.from||"0"), to: String((r.to||"MAX")).toUpperCase()==='MAX'? 'MAX' : String(r.to), multipliedWith: String(r.multipliedWith||"") }));
      setInventorySettingsByVendor(prev => {
        const existsIdx = prev.findIndex(v=> v.vendorId===toId);
        if (existsIdx !== -1) {
          const proceed = window.confirm('Target vendor already has Inventory Settings. Overwrite them?');
          if (!proceed) return prev;
          const updated = [...prev];
          updated[existsIdx] = { ...updated[existsIdx], priceRanges: rangesCopy };
          return updated;
        }
        const newEntry = { vendorId: toId, priceRanges: rangesCopy };
        return [...prev, newEntry];
      });
      toast.success('Inventory settings duplicated');
      closeDuplicateModal();
    }
  };

  // Navigation Handlers
  const goToNextStep = () => {
    if (activeStep === "store-info") {
      if (!storeInfo.storeName || !storeInfo.marketplace) { toast.error("Please fill in all required fields"); return; }
      setActiveStep("price-settings");
    } else if (activeStep === "price-settings") {
      // Validate contiguous price ranges per vendor
      for (const v of priceSettingsByVendor) { if (!rangesAreContiguous(v.priceRanges)) { toast.error('Price ranges must be contiguous and end with MAX'); return; } }
      setActiveStep("inventory-settings");
    }
  };

  const goToPreviousStep = () => {
    if (activeStep === "price-settings") {
      setActiveStep("store-info");
    } else if (activeStep === "inventory-settings") {
      setActiveStep("price-settings");
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      // Validate contiguous inventory ranges per vendor
      for (const v of inventorySettingsByVendor) { if (!rangesAreContiguous(v.priceRanges)) { toast.error('Inventory ranges must be contiguous and end with MAX'); return; } }
      const storeData = transformStoreDataForAPI(storeInfo, priceSettingsByVendor, inventorySettingsByVendor);
      if (isEditMode && storeId !== null) {
        await marketplaceAPI.updateStore(storeId, storeData);
        toast.success("Store updated successfully");
      } else {
        await marketplaceAPI.createStore(storeData);
        toast.success("Store created successfully");
      }
      navigate("/settings");
    } catch (err) {
      console.error('Error saving store:', err);
      toast.error(isEditMode ? 'Failed to update store' : 'Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? 'Edit Store' : 'Create New Store'}</h1>
      </div>

      <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="store-info">Store Information</TabsTrigger>
          <TabsTrigger value="price-settings">Price Settings</TabsTrigger>
          <TabsTrigger value="inventory-settings">Inventory Settings</TabsTrigger>
        </TabsList>

        {/* Store Information */}
        <TabsContent value="store-info" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Store Information</h2>
            <div className="border rounded-md p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input id="storeName" placeholder="Enter your store name" value={storeInfo.storeName} onChange={(e) => updateStoreInfo("storeName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketplace">Marketplace</Label>
                <Select value={storeInfo.marketplace} onValueChange={(value) => updateStoreInfo("marketplace", value)}>
                  <SelectTrigger id="marketplace" className="w-full">
                    <SelectValue placeholder="Select a marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaces.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id.toString()}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input id="apiKey" type="password" placeholder="Enter your marketplace API key" value={storeInfo.apiKey} onChange={(e) => updateStoreInfo("apiKey", e.target.value)} />
                <p className="text-sm text-gray-500">Your API key will be encrypted and stored securely</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/settings")}>Cancel</Button>
            <Button onClick={goToNextStep}>Continue</Button>
          </div>
        </TabsContent>

        {/* Price Settings */}
        <TabsContent value="price-settings" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Price Settings</h2>
            <div className="flex items-center gap-2">
              <Select value={pricePendingVendor} onValueChange={setPricePendingVendor}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {availablePriceVendors.map(v => (<SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button size="icon" onClick={addPriceVendor}><Plus className="w-4 h-4" /></Button>
              <Button variant="secondary" onClick={()=> openDuplicateModal('price')}><Copy className="w-4 h-4 mr-2" />Duplicate</Button>
            </div>
            {priceSettingsByVendor.map(v => (
              <div key={v.vendorId} className="border rounded-md p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{vendors.find(x=>x.id===v.vendorId)?.name || `Vendor ${v.vendorId}`}</h3>
                  <Button variant="outline" onClick={() => removePriceVendor(v.vendorId)}>Remove</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Purchase Tax (%)</Label>
                    <Input value={v.purchaseTax} onChange={(e)=> updatePriceVendorField(v.vendorId, 'purchaseTax', e.target.value)} placeholder="Enter purchase tax" />
                  </div>
                  <div className="space-y-2">
                    <Label>Marketplace Fees (%)</Label>
                    <Input value={v.marketplaceFees} onChange={(e)=> updatePriceVendorField(v.vendorId, 'marketplaceFees', e.target.value)} placeholder="Enter marketplace fees" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Price Ranges</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Margin (%)</TableHead>
                          <TableHead>Minimum Margin</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {v.priceRanges.map((range, index) => (
                          <TableRow key={index}>
                            <TableCell className="p-0"><Input type="text" value={range.from} onChange={(e)=> updatePriceRange(v.vendorId, index, 'from', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" /></TableCell>
                            <TableCell className="p-0">{index===v.priceRanges.length-1 ? (<Input value="MAX" readOnly className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted" />) : (<Input type="text" value={range.to} onChange={(e)=> updatePriceRange(v.vendorId, index, 'to', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="100" />)}</TableCell>
                            <TableCell className="p-0"><Input type="text" value={range.margin} onChange={(e)=> updatePriceRange(v.vendorId, index, 'margin', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="30" /></TableCell>
                            <TableCell className="p-0"><Input type="text" value={range.minimumMargin} onChange={(e)=> updatePriceRange(v.vendorId, index, 'minimumMargin', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="25" /></TableCell>
                            <TableCell className="p-0"><div className="flex gap-2">{v.priceRanges.length>1 && (<Button onClick={()=> removePriceRangeRow(v.vendorId, index)} variant="ghost" className="p-2"><Trash2 className="w-4 h-4 text-red-500" /></Button>)}{index===v.priceRanges.length-1 && (<Button onClick={()=> addPriceRange(v.vendorId)} variant="ghost" className="p-2"><Plus className="w-4 h-4" /></Button>)}</div></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={goToPreviousStep}>Back</Button>
            <Button onClick={goToNextStep}>Continue</Button>
          </div>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory-settings" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Inventory Multiplier Ranges</h2>
            <div className="flex items-center gap-2">
              <Select value={inventoryPendingVendor} onValueChange={setInventoryPendingVendor}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {availableInventoryVendors.map(v => (<SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button size="icon" onClick={addInventoryVendor}><Plus className="w-4 h-4" /></Button>
              <Button variant="secondary" onClick={()=> openDuplicateModal('inventory')}><Copy className="w-4 h-4 mr-2" />Duplicate</Button>
            </div>
            {inventorySettingsByVendor.map(v => (
              <div key={v.vendorId} className="border rounded-md p-6 space-y-6">
                <div className="flex items-center justify-between"><h3 className="font-medium">{vendors.find(x=>x.id===v.vendorId)?.name || `Vendor ${v.vendorId}`}</h3><Button variant="outline" onClick={()=> removeInventoryVendor(v.vendorId)}>Remove</Button></div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Multiplied with</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {v.priceRanges.map((range, index) => (
                        <TableRow key={index}>
                          <TableCell className="p-0"><Input type="text" value={range.from} onChange={(e)=> updateInventoryRange(v.vendorId, index, 'from', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0" /></TableCell>
                          <TableCell className="p-0">{index===v.priceRanges.length-1 ? (<Input value="MAX" readOnly className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted" />) : (<Input type="text" value={range.to} onChange={(e)=> updateInventoryRange(v.vendorId, index, 'to', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="100" />)}</TableCell>
                          <TableCell className="p-0"><Input type="text" value={range.multipliedWith} onChange={(e)=> updateInventoryRange(v.vendorId, index, 'multipliedWith', e.target.value)} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="0.5" /></TableCell>
                          <TableCell className="p-0"><div className="flex gap-2">{v.priceRanges.length>1 && (<Button onClick={()=> removeInventoryRangeRow(v.vendorId, index)} variant="ghost" className="p-2"><Trash2 className="w-4 h-4 text-red-500" /></Button>)}{index===v.priceRanges.length-1 && (<Button onClick={()=> addInventoryRange(v.vendorId)} variant="ghost" className="p-2"><Plus className="w-4 h-4" /></Button>)}</div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={goToPreviousStep}>Back</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : (isEditMode ? 'Update Store' : 'Create Store')}</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Duplicate Modal */}
      {duplicateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeDuplicateModal} />
          <div className="relative bg-white rounded-md shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">{duplicateModal.type === 'price' ? 'Duplicate Price Settings' : 'Duplicate Inventory Settings'}</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Copy from vendor</Label>
                <Select value={duplicateModal.fromVendorId} onValueChange={(value)=> setDuplicateModal(prev=> ({ ...prev, fromVendorId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select source vendor" /></SelectTrigger>
                  <SelectContent>
                    {(duplicateModal.type==='price' ? priceSettingsByVendor : inventorySettingsByVendor).map(v => (
                      <SelectItem key={v.vendorId} value={v.vendorId.toString()}>{vendors.find(x=>x.id===v.vendorId)?.name || `Vendor ${v.vendorId}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Copy to vendor</Label>
                <Select value={duplicateModal.toVendorId} onValueChange={(value)=> setDuplicateModal(prev=> ({ ...prev, toVendorId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select target vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {duplicateModal.type==='price' && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={duplicateModal.copyFees} onChange={(e)=> setDuplicateModal(prev=> ({ ...prev, copyFees: e.target.checked }))} />
                  Include tax & marketplace fees
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDuplicateModal}>Cancel</Button>
              <Button onClick={applyDuplicate}><Copy className="w-4 h-4 mr-2" />Duplicate</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
