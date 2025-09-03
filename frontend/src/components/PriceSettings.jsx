import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "react-toastify";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Plus } from "lucide-react";

function sortRanges(ranges) {
  return [...ranges].sort((a, b) => (parseFloat(a.from || 0) - parseFloat(b.from || 0)));
}

function rangesAreContiguous(ranges) {
  if (!ranges.length) return true;
  const sr = sortRanges(ranges);
  const firstFrom = parseFloat(sr[0].from || 0);
  if (firstFrom !== 0) return false;
  for (let i = 0; i < sr.length - 1; i++) {
    const curTo = sr[i].to;
    const nextFrom = sr[i + 1].from;
    if (String(curTo) !== String(nextFrom)) return false;
  }
  const lastTo = String(sr[sr.length - 1].to || "MAX");
  return lastTo === "MAX";
}

export default function PriceSettings({
  vendors = [],
  priceSettingsByVendor = [],
  setPriceSettingsByVendor,
  inventorySettingsByVendor = [],
  setInventorySettingsByVendor,
}) {
  const [activeTab, setActiveTab] = useState("price");
  const [pendingVendorId, setPendingVendorId] = useState("");

  const usedVendorIdsPrice = useMemo(() => new Set(priceSettingsByVendor.map(v => v.vendorId)), [priceSettingsByVendor]);
  const usedVendorIdsInventory = useMemo(() => new Set(inventorySettingsByVendor.map(v => v.vendorId)), [inventorySettingsByVendor]);

  const availableVendorsForPrice = useMemo(() => vendors.filter(v => !usedVendorIdsPrice.has(v.id)), [vendors, usedVendorIdsPrice]);
  const availableVendorsForInventory = useMemo(() => vendors.filter(v => !usedVendorIdsInventory.has(v.id)), [vendors, usedVendorIdsInventory]);

  const addVendorToActiveTab = () => {
    if (!pendingVendorId) {
      toast.error("Select a vendor first");
      return;
    }
    const vid = parseInt(pendingVendorId);
    if (activeTab === "price") {
      if (usedVendorIdsPrice.has(vid)) {
        toast.error("Vendor already added to Price");
        return;
      }
      setPriceSettingsByVendor(prev => ([...prev, {
        vendorId: vid,
        purchaseTax: "0",
        marketplaceFees: "0",
        priceRanges: [{ from: "0", to: "MAX", margin: "0", minimumMargin: "0" }],
      }]));
    } else {
      if (usedVendorIdsInventory.has(vid)) {
        toast.error("Vendor already added to Inventory");
        return;
      }
      setInventorySettingsByVendor(prev => ([...prev, {
        vendorId: vid,
        priceRanges: [{ from: "0", to: "MAX", multipliedWith: "1" }],
      }]));
    }
    setPendingVendorId("");
  };

  const removeVendor = (tab, vendorId) => {
    if (tab === "price") {
      setPriceSettingsByVendor(prev => prev.filter(v => v.vendorId !== vendorId));
    } else {
      setInventorySettingsByVendor(prev => prev.filter(v => v.vendorId !== vendorId));
    }
  };

  const updateVendorField = (vendorId, field, value) => {
    setPriceSettingsByVendor(prev => prev.map(v => v.vendorId === vendorId ? { ...v, [field]: value } : v));
  };

  const updatePriceRange = (vendorId, idx, field, value) => {
    setPriceSettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      const priceRanges = v.priceRanges.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      return { ...v, priceRanges };
    }));
  };

  const addPriceRange = (vendorId) => {
    setPriceSettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      return { ...v, priceRanges: [...v.priceRanges, { from: "0", to: "MAX", margin: "0", minimumMargin: "0" }] };
    }));
  };

  const removePriceRange = (vendorId, idx) => {
    setPriceSettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      const next = v.priceRanges.filter((_, i) => i !== idx);
      return { ...v, priceRanges: next };
    }));
  };

  const updateInventoryRange = (vendorId, idx, field, value) => {
    setInventorySettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      const priceRanges = v.priceRanges.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      return { ...v, priceRanges };
    }));
  };

  const addInventoryRange = (vendorId) => {
    setInventorySettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      return { ...v, priceRanges: [...v.priceRanges, { from: "0", to: "MAX", multipliedWith: "1" }] };
    }));
  };

  const removeInventoryRange = (vendorId, idx) => {
    setInventorySettingsByVendor(prev => prev.map(v => {
      if (v.vendorId !== vendorId) return v;
      const next = v.priceRanges.filter((_, i) => i !== idx);
      return { ...v, priceRanges: next };
    }));
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="price">Price</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
      </TabsList>

      <TabsContent value="price">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={pendingVendorId} onValueChange={setPendingVendorId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {availableVendorsForPrice.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" onClick={addVendorToActiveTab}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {priceSettingsByVendor.map(v => {
            const vendor = vendors.find(x => x.id === v.vendorId);
            return (
              <div key={v.vendorId} className="border rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{vendor?.name || `Vendor ${v.vendorId}`}</h3>
                  <Button variant="outline" onClick={() => removeVendor("price", v.vendorId)}>Remove</Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Purchase Tax %</Label>
                    <Input value={v.purchaseTax} onChange={(e) => updateVendorField(v.vendorId, 'purchaseTax', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Marketplace Fees %</Label>
                    <Input value={v.marketplaceFees} onChange={(e) => updateVendorField(v.vendorId, 'marketplaceFees', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Price Ranges</Label><Button size="sm" onClick={() => addPriceRange(v.vendorId)}>Add Range</Button></div>
                  <div className="space-y-2">
                    {v.priceRanges.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                        <Input placeholder="From" value={r.from} onChange={(e) => updatePriceRange(v.vendorId, idx, 'from', e.target.value)} />
                        <Input placeholder="To ('MAX' or number)" value={r.to} onChange={(e) => updatePriceRange(v.vendorId, idx, 'to', e.target.value)} />
                        <Input placeholder="Margin %" value={r.margin} onChange={(e) => updatePriceRange(v.vendorId, idx, 'margin', e.target.value)} />
                        <Input placeholder="Min Margin" value={r.minimumMargin} onChange={(e) => updatePriceRange(v.vendorId, idx, 'minimumMargin', e.target.value)} />
                        <Button variant="outline" onClick={() => removePriceRange(v.vendorId, idx)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="inventory">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={pendingVendorId} onValueChange={setPendingVendorId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {availableVendorsForInventory.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" onClick={addVendorToActiveTab}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {inventorySettingsByVendor.map(v => {
            const vendor = vendors.find(x => x.id === v.vendorId);
            return (
              <div key={v.vendorId} className="border rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{vendor?.name || `Vendor ${v.vendorId}`}</h3>
                  <Button variant="outline" onClick={() => removeVendor("inventory", v.vendorId)}>Remove</Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Inventory Ranges</Label><Button size="sm" onClick={() => addInventoryRange(v.vendorId)}>Add Range</Button></div>
                  <div className="space-y-2">
                    {v.priceRanges.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                        <Input placeholder="From" value={r.from} onChange={(e) => updateInventoryRange(v.vendorId, idx, 'from', e.target.value)} />
                        <Input placeholder="To ('MAX' or number)" value={r.to} onChange={(e) => updateInventoryRange(v.vendorId, idx, 'to', e.target.value)} />
                        <Input placeholder="Multiplier" value={r.multipliedWith} onChange={(e) => updateInventoryRange(v.vendorId, idx, 'multipliedWith', e.target.value)} />
                        <Button variant="outline" onClick={() => removeInventoryRange(v.vendorId, idx)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}

PriceSettings.validateRanges = (priceSettingsByVendor = [], inventorySettingsByVendor = []) => {
  for (const v of priceSettingsByVendor) {
    if (!rangesAreContiguous(v.priceRanges)) return false;
  }
  for (const v of inventorySettingsByVendor) {
    if (!rangesAreContiguous(v.priceRanges)) return false;
  }
  return true;
}; 