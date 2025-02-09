import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"

export default function SettingsLayout() {
  const vendors = ["Vendor A", "Vendor B", "Vendor C"]
  const [selectedVendor, setSelectedVendor] = useState(vendors[0])
  const [showSecret, setShowSecret] = useState(false)
  const [activeTab, setActiveTab] = useState("api")

  // Updated price ranges state to include lower and upper bounds
  const [priceRanges, setPriceRanges] = useState({
    "Vendor A": [
      {
        vendorPriceLower: "",
        vendorPriceUpper: "",
        marketplaceProfitLower: "",
        marketplaceProfitUpper: "",
      },
    ],
    "Vendor B": [
      {
        vendorPriceLower: "",
        vendorPriceUpper: "",
        marketplaceProfitLower: "",
        marketplaceProfitUpper: "",
      },
    ],
    "Vendor C": [
      {
        vendorPriceLower: "",
        vendorPriceUpper: "",
        marketplaceProfitLower: "",
        marketplaceProfitUpper: "",
      },
    ],
  })

  // State for inventory ranges
  const [inventoryRanges, setInventoryRanges] = useState({
    "Vendor A": [
      {
        vendorQtyLower: "",
        vendorQtyUpper: "",
        marketplaceQtyLower: "",
        marketplaceQtyUpper: "",
      },
    ],
    "Vendor B": [
      {
        vendorQtyLower: "",
        vendorQtyUpper: "",
        marketplaceQtyLower: "",
        marketplaceQtyUpper: "",
      },
    ],
    "Vendor C": [
      {
        vendorQtyLower: "",
        vendorQtyUpper: "",
        marketplaceQtyLower: "",
        marketplaceQtyUpper: "",
      },
    ],
  })

  const [cycleTime, setCycleTime] = useState("12:00")

  const addPriceRange = (vendor) => {
    setPriceRanges({
      ...priceRanges,
      [vendor]: [
        ...priceRanges[vendor],
        {
          vendorPriceLower: "",
          vendorPriceUpper: "",
          marketplaceProfitLower: "",
          marketplaceProfitUpper: "",
        },
      ],
    })
  }

  const addInventoryRange = (vendor) => {
    setInventoryRanges({
      ...inventoryRanges,
      [vendor]: [
        ...inventoryRanges[vendor],
        {
          vendorQtyLower: "",
          vendorQtyUpper: "",
          marketplaceQtyLower: "",
          marketplaceQtyUpper: "",
        },
      ],
    })
  }

  const removePriceRange = (vendor, index) => {
    const newRanges = { ...priceRanges }
    newRanges[vendor].splice(index, 1)
    setPriceRanges(newRanges)
  }

  const removeInventoryRange = (vendor, index) => {
    const newRanges = { ...inventoryRanges }
    newRanges[vendor].splice(index, 1)
    setInventoryRanges(newRanges)
  }

  const updatePriceRange = (vendor, index, field, value) => {
    const newRanges = { ...priceRanges }
    newRanges[vendor][index][field] = value
    setPriceRanges(newRanges)
  }

  const updateInventoryRange = (vendor, index, field, value) => {
    const newRanges = { ...inventoryRanges }
    newRanges[vendor][index][field] = value
    setInventoryRanges(newRanges)
  }

  const handleTabChange = (value) => {
    setActiveTab(value)
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/40 p-4">
        <nav className="space-y-2">
          <a
            href="#"
            className={`block px-4 py-2 rounded-md hover:bg-muted ${activeTab === "api" ? "bg-muted" : ""}`}
            onClick={() => handleTabChange("api")}
          >
            API Tokens / Credentials
          </a>
          <a
            href="#"
            className={`block px-4 py-2 rounded-md hover:bg-muted ${activeTab === "price-margin" ? "bg-muted" : ""}`}
            onClick={() => handleTabChange("price-margin")}
          >
            Price Margin Formula
          </a>
          <a
            href="#"
            className={`block px-4 py-2 rounded-md hover:bg-muted ${activeTab === "inventory" ? "bg-muted" : ""}`}
            onClick={() => handleTabChange("inventory")}
          >
            Inventory Formula
          </a>
          <a
            href="#"
            className={`block px-4 py-2 rounded-md hover:bg-muted ${activeTab === "cycle-time" ? "bg-muted" : ""}`}
            onClick={() => handleTabChange("cycle-time")}
          >
            Inventory Cycle Time
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="api">API Tokens</TabsTrigger>
            <TabsTrigger value="price-margin">Price Margin</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="cycle-time">Cycle Time</TabsTrigger>
          </TabsList>

          {/* API Tokens Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Tokens / Credentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client ID</label>
                  <div className="flex">
                    <Input type="text" value="your-client-id-here" readOnly className="flex-grow" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="ml-2"
                      onClick={() => {
                        navigator.clipboard.writeText("your-client-id-here")
                        // You might want to add a toast notification here
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Secret</label>
                  <div className="flex">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value="your-client-secret-here"
                      readOnly
                      className="flex-grow"
                    />
                    <Button variant="outline" size="icon" className="ml-2" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="ml-2"
                      onClick={() => {
                        navigator.clipboard.writeText("your-client-secret-here")
                        // You might want to add a toast notification here
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button>Generate New Credentials</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Price Margin Tab */}
          <TabsContent value="price-margin">
            <Card>
              <CardHeader>
                <CardTitle>Price Margin Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger>
                    <SelectValue>{selectedVendor}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="mt-4 space-y-6">
                  {priceRanges[selectedVendor].map((range, index) => (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Vendor Price Range</label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="Lower bound"
                              value={range.vendorPriceLower}
                              onChange={(e) =>
                                updatePriceRange(selectedVendor, index, "vendorPriceLower", e.target.value)
                              }
                            />
                            <span>to</span>
                            <Input
                              type="number"
                              placeholder="Upper bound"
                              value={range.vendorPriceUpper}
                              onChange={(e) =>
                                updatePriceRange(selectedVendor, index, "vendorPriceUpper", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Marketplace Profit Range</label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="Lower bound"
                              value={range.marketplaceProfitLower}
                              onChange={(e) =>
                                updatePriceRange(selectedVendor, index, "marketplaceProfitLower", e.target.value)
                              }
                            />
                            <span>to</span>
                            <Input
                              type="number"
                              placeholder="Upper bound"
                              value={range.marketplaceProfitUpper}
                              onChange={(e) =>
                                updatePriceRange(selectedVendor, index, "marketplaceProfitUpper", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePriceRange(selectedVendor, index)}
                          className="absolute top-2 right-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button onClick={() => addPriceRange(selectedVendor)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Price Range
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger>
                    <SelectValue>{selectedVendor}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="mt-4 space-y-6">
                  {inventoryRanges[selectedVendor].map((range, index) => (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Vendor Quantity Range</label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="Lower bound"
                              value={range.vendorQtyLower}
                              onChange={(e) =>
                                updateInventoryRange(selectedVendor, index, "vendorQtyLower", e.target.value)
                              }
                            />
                            <span>to</span>
                            <Input
                              type="number"
                              placeholder="Upper bound"
                              value={range.vendorQtyUpper}
                              onChange={(e) =>
                                updateInventoryRange(selectedVendor, index, "vendorQtyUpper", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Marketplace Quantity Range</label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="Lower bound"
                              value={range.marketplaceQtyLower}
                              onChange={(e) =>
                                updateInventoryRange(selectedVendor, index, "marketplaceQtyLower", e.target.value)
                              }
                            />
                            <span>to</span>
                            <Input
                              type="number"
                              placeholder="Upper bound"
                              value={range.marketplaceQtyUpper}
                              onChange={(e) =>
                                updateInventoryRange(selectedVendor, index, "marketplaceQtyUpper", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInventoryRange(selectedVendor, index)}
                          className="absolute top-2 right-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button onClick={() => addInventoryRange(selectedVendor)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Quantity Range
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cycle Time Tab */}
          <TabsContent value="cycle-time">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Cycle Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Frequency</label>
                  <Input type="time" value={cycleTime} onChange={(e) => setCycleTime(e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

