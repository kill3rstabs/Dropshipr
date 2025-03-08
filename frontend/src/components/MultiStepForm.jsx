"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export default function CreateStoreForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState("store-info");
  const [isEditMode, setIsEditMode] = useState(false);
  const [storeId, setStoreId] = useState(null);

  // Store Information State
  const [storeInfo, setStoreInfo] = useState({
    storeName: "",
    marketplace: "",
  });

  // Price Settings State
  const [priceSettings, setPriceSettings] = useState({
    purchaseTax: "",
    marketplaceFees: "",
    priceRanges: [{ from: "", to: "MAX", margin: "", minimumMargin: "" }],
  });

  // Inventory Settings State
  const [inventorySettings, setInventorySettings] = useState({
    priceRanges: [{ from: "", to: "MAX", multipliedWith: "" }],
  });

  // Sample marketplaces
  const marketplaces = [
    { id: "amazon", name: "Amazon" },
    { id: "ebay", name: "eBay" },
    { id: "etsy", name: "Etsy" },
    { id: "shopify", name: "Shopify" },
    { id: "walmart", name: "Walmart" },
  ];

  // Check if we're in edit mode
  useEffect(() => {
    if (location.state && location.state.storeData) {
      const { id, storeInfo: editStoreInfo, priceSettings: editPriceSettings, inventorySettings: editInventorySettings } = location.state.storeData;
      
      setIsEditMode(true);
      setStoreId(id);
      
      if (editStoreInfo) setStoreInfo(editStoreInfo);
      if (editPriceSettings) setPriceSettings(editPriceSettings);
      if (editInventorySettings) setInventorySettings(editInventorySettings);
    }
  }, [location.state]);

  // Store Info Handlers
  const updateStoreInfo = (field, value) => {
    setStoreInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Price Settings Handlers
  const updatePriceSettings = (field, value) => {
    const numericValue = field !== "priceRanges" ? value.replace(/[^0-9.]/g, "") : value;
    setPriceSettings((prev) => ({
      ...prev,
      [field]: numericValue,
    }));
  };

  const addPriceRange = () => {
    const updatedRanges = [...priceSettings.priceRanges];
    const lastIndex = updatedRanges.length - 1;

    const fromValue = updatedRanges[lastIndex].from || "0";
    const toValue = fromValue ? (parseInt(fromValue) + 100).toString() : "100";

    updatedRanges[lastIndex] = {
      ...updatedRanges[lastIndex],
      to: toValue,
    };

    setPriceSettings((prev) => ({
      ...prev,
      priceRanges: [...updatedRanges, { from: toValue, to: "MAX", margin: "", minimumMargin: "" }],
    }));
  };

  const updatePriceRange = (index, field, value) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    const updatedRanges = [...priceSettings.priceRanges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      [field]: numericValue,
    };

    setPriceSettings((prev) => ({
      ...prev,
      priceRanges: updatedRanges,
    }));
  };

  const removePriceRange = (index) => {
    if (priceSettings.priceRanges.length > 1) {
      const updatedRanges = priceSettings.priceRanges.filter((_, i) => i !== index);

      if (index === priceSettings.priceRanges.length - 1) {
        const newLastIndex = updatedRanges.length - 1;
        updatedRanges[newLastIndex] = {
          ...updatedRanges[newLastIndex],
          to: "MAX",
        };
      }

      setPriceSettings((prev) => ({
        ...prev,
        priceRanges: updatedRanges,
      }));
    }
  };

  // Inventory Settings Handlers
  const addInventoryRange = () => {
    const updatedRanges = [...inventorySettings.priceRanges];
    const lastIndex = updatedRanges.length - 1;

    const fromValue = updatedRanges[lastIndex].from || "0";
    const toValue = fromValue ? (parseInt(fromValue) + 100).toString() : "100";

    updatedRanges[lastIndex] = {
      ...updatedRanges[lastIndex],
      to: toValue,
    };

    setInventorySettings((prev) => ({
      ...prev,
      priceRanges: [...updatedRanges, { from: toValue, to: "MAX", multipliedWith: "" }],
    }));
  };

  const updateInventoryRange = (index, field, value) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    const updatedRanges = [...inventorySettings.priceRanges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      [field]: numericValue,
    };

    setInventorySettings((prev) => ({
      ...prev,
      priceRanges: updatedRanges,
    }));
  };

  const removeInventoryRange = (index) => {
    if (inventorySettings.priceRanges.length > 1) {
      const updatedRanges = inventorySettings.priceRanges.filter((_, i) => i !== index);

      if (index === inventorySettings.priceRanges.length - 1) {
        const newLastIndex = updatedRanges.length - 1;
        updatedRanges[newLastIndex] = {
          ...updatedRanges[newLastIndex],
          to: "MAX",
        };
      }

      setInventorySettings((prev) => ({
        ...prev,
        priceRanges: updatedRanges,
      }));
    }
  };

  // Navigation Handlers
  const goToNextStep = () => {
    if (activeStep === "store-info") {
      setActiveStep("price-settings");
    } else if (activeStep === "price-settings") {
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

  const handleSubmit = () => {
    const formData = {
      storeInfo,
      priceSettings,
      inventorySettings,
    };

    // Get existing stores from localStorage
    const existingStores = JSON.parse(localStorage.getItem('stores') || '[]');
    
    if (isEditMode && storeId !== null) {
      // Update existing store
      const updatedStores = existingStores.map(store => 
        store.id === storeId ? { id: storeId, ...formData, active: store.active } : store
      );
      localStorage.setItem('stores', JSON.stringify(updatedStores));
      toast.success("Store updated successfully");
    } else {
      // Create new store
      const newStore = {
        id: Date.now(), // Use timestamp as simple ID
        ...formData,
        active: true // New stores are active by default
      };
      localStorage.setItem('stores', JSON.stringify([...existingStores, newStore]));
      toast.success("Store created successfully");
    }

    navigate("/settings");
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
                <Input
                  id="storeName"
                  placeholder="Enter your store name"
                  value={storeInfo.storeName}
                  onChange={(e) => updateStoreInfo("storeName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketplace">Marketplace</Label>
                <Select value={storeInfo.marketplace} onValueChange={(value) => updateStoreInfo("marketplace", value)}>
                  <SelectTrigger id="marketplace" className="w-full">
                    <SelectValue placeholder="Select a marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaces.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseTax">Purchase Tax (%)</Label>
                <Input
                  id="purchaseTax"
                  placeholder="Enter purchase tax"
                  value={priceSettings.purchaseTax}
                  onChange={(e) => updatePriceSettings("purchaseTax", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketplaceFees">Marketplace Fees (%)</Label>
                <Input
                  id="marketplaceFees"
                  placeholder="Enter marketplace fees"
                  value={priceSettings.marketplaceFees}
                  onChange={(e) => updatePriceSettings("marketplaceFees", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Price Ranges</h2>

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
                    {priceSettings.priceRanges.map((range, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-0">
                          <Input
                            type="text"
                            value={range.from}
                            onChange={(e) => updatePriceRange(index, "from", e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="p-0">
                          {index === priceSettings.priceRanges.length - 1 ? (
                            <Input
                              value="MAX"
                              readOnly
                              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted"
                            />
                          ) : (
                            <Input
                              type="text"
                              value={range.to}
                              onChange={(e) => updatePriceRange(index, "to", e.target.value)}
                              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                              placeholder="100"
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-0">
                          <Input
                            type="text"
                            value={range.margin}
                            onChange={(e) => updatePriceRange(index, "margin", e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="30"
                          />
                        </TableCell>
                        <TableCell className="p-0">
                          <Input
                            type="text"
                            value={range.minimumMargin}
                            onChange={(e) => updatePriceRange(index, "minimumMargin", e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="25"
                          />
                        </TableCell>
                        <TableCell className="p-0">
                          <div className="flex gap-2">
                            {priceSettings.priceRanges.length > 1 && (
                              <Button onClick={() => removePriceRange(index)} variant="ghost" className="p-2">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                            {index === priceSettings.priceRanges.length - 1 && (
                              <Button onClick={addPriceRange} variant="ghost" className="p-2">
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={goToPreviousStep}>Back</Button>
            <Button onClick={goToNextStep}>Continue</Button>
          </div>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory-settings" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Price Multiplier Ranges</h2>

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
                  {inventorySettings.priceRanges.map((range, index) => (
                    <TableRow key={index}>
                      <TableCell className="p-0">
                        <Input
                          type="text"
                          value={range.from}
                          onChange={(e) => updateInventoryRange(index, "from", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="p-0">
                        {index === inventorySettings.priceRanges.length - 1 ? (
                          <Input
                            value="MAX"
                            readOnly
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={range.to}
                            onChange={(e) => updateInventoryRange(index, "to", e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="100"
                          />
                        )}
                      </TableCell>
                      <TableCell className="p-0">
                        <Input
                          type="text"
                          value={range.multipliedWith}
                          onChange={(e) => updateInventoryRange(index, "multipliedWith", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="0.5"
                        />
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="flex gap-2">
                          {inventorySettings.priceRanges.length > 1 && (
                            <Button onClick={() => removeInventoryRange(index)} variant="ghost" className="p-2">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                          {index === inventorySettings.priceRanges.length - 1 && (
                            <Button onClick={addInventoryRange} variant="ghost" className="p-2">
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={goToPreviousStep}>Back</Button>
            <Button onClick={handleSubmit}>Create Store</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
