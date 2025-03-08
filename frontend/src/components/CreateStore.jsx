import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function CreateStore() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    storeName: "",
    marketplace: "",
    priceSettings: null,
  });

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
            <SelectItem value="amazon">Amazon</SelectItem>
            <SelectItem value="flipkart">Flipkart</SelectItem>
            <SelectItem value="meesho">Meesho</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const InventorySettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Inventory Settings</h2>
      <p className="text-gray-500">Coming soon...</p>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StoreDetailsForm />;
      case 2:
        return <PriceSettings />;
      case 3:
        return <InventorySettings />;
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
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
        <h1 className="text-3xl font-bold tracking-tight">Create New Store</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3].map((step) => (
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
          onClick={currentStep === 3 ? () => navigate("/settings") : handleNext}
          disabled={isNextDisabled()}
        >
          {currentStep === 3 ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
} 