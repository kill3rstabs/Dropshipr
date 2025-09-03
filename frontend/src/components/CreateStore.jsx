import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import PriceSettings from "./PriceSettings";
import { marketplaceAPI, transformStoreDataForAPI } from "../services/api";
import { toast } from "react-toastify";

export default function CreateStore() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingStore = location.state?.storeData || null;

  const [currentStep, setCurrentStep] = useState(1);
  const [vendors, setVendors] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [formData, setFormData] = useState({
    storeName: editingStore?.storeInfo?.storeName || "",
    marketplace: editingStore?.marketplace_id ? String(editingStore.marketplace_id) : "",
    apiKey: editingStore?.storeInfo?.apiKey || "",
  });
  const [priceSettingsByVendor, setPriceSettingsByVendor] = useState(editingStore?.priceSettingsByVendor || []);
  const [inventorySettingsByVendor, setInventorySettingsByVendor] = useState(editingStore?.inventorySettingsByVendor || []);

  useEffect(() => {
    (async () => {
      try {
        const [v, mp] = await Promise.all([
          marketplaceAPI.getVendors(),
          marketplaceAPI.getMarketplaces(),
        ]);
        setVendors(v || []);
        setMarketplaces(mp || []);
      } catch (e) {
        console.error('Failed to load vendors/marketplaces', e);
      }
    })();
  }, []);

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const StoreDetailsForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="storeName">Store Name</Label>
        <Input 
          id="storeName"
          value={formData.storeName}
          onChange={(e) => updateFormData("storeName", e.target.value)}
          placeholder="Enter store name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="marketplace">Marketplace</Label>
        <Select 
          value={formData.marketplace}
          onValueChange={(value) => updateFormData("marketplace", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select marketplace" />
          </SelectTrigger>
          <SelectContent>
            {marketplaces.map(mp => (
              <SelectItem key={mp.id} value={String(mp.id)}>{mp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key (optional)</Label>
        <Input 
          id="apiKey"
          value={formData.apiKey}
          onChange={(e) => updateFormData("apiKey", e.target.value)}
          placeholder="Enter API key"
        />
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StoreDetailsForm />;
      case 2:
        return (
          <PriceSettings 
            vendors={vendors}
            priceSettingsByVendor={priceSettingsByVendor}
            setPriceSettingsByVendor={setPriceSettingsByVendor}
            inventorySettingsByVendor={inventorySettingsByVendor}
            setInventorySettingsByVendor={setInventorySettingsByVendor}
          />
        );
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const submit = async () => {
    // validate ranges
    const ok = PriceSettings.validateRanges(priceSettingsByVendor, inventorySettingsByVendor);
    if (!ok) {
      return;
    }
    try {
      const payload = transformStoreDataForAPI(
        { storeName: formData.storeName, marketplace: formData.marketplace, apiKey: formData.apiKey },
        priceSettingsByVendor,
        inventorySettingsByVendor,
      );
      if (editingStore) {
        await marketplaceAPI.updateStore(editingStore.id, payload);
        toast.success('Store updated');
      } else {
        await marketplaceAPI.createStore(payload);
        toast.success('Store created');
      }
      navigate('/settings');
    } catch (e) {
      console.error('Failed to save store', e);
      toast.error('Failed to save store');
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 1) {
      return !formData.storeName || !formData.marketplace;
    }
    return false;
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{editingStore ? 'Edit Store' : 'Create New Store'}</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2].map((step) => (
          <div
            key={step}
            className={`h-2 w-16 rounded-full ${
              step <= currentStep ? "bg-blue-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {renderStep()}

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        <Button
          onClick={currentStep === 2 ? submit : handleNext}
          disabled={isNextDisabled()}
        >
          {currentStep === 2 ? (editingStore ? 'Save' : 'Create') : "Next"}
        </Button>
      </div>
    </div>
  );
} 