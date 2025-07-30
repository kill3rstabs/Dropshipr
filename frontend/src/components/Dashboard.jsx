import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { 
  FolderSyncIcon as Sync, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  DollarSign
} from "lucide-react"

export default function Dashboard() {
  // Sample data - in a real app this would come from an API or props
  const totalItems = [
    { platform: "Amazon XYZ", count: 5000 },
    { platform: "Mydal XYZ", count: 10000 },
    { platform: "Mydeal PWD", count: 10000 },
  ]

  const vendorData = [
    { name: "eBay", date: "2/9/2025" },
    { name: "Amazon", date: "2/9/2025" },
    { name: "Dropshipzone", date: "2/9/2025" },
    { name: "Idropship", date: "2/9/2025" },
  ]

  const marketplaceData = [
    { name: "Mydeals", date: "2/9/2025" },
    { name: "Amazon", date: "2/9/2025" },
  ]

  return (
    <div className="p-6 bg-walmart-gray min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your dropshipping business.</p>
        </div>
        <Button className="walmart-button-primary">
          <Sync className="mr-2 h-5 w-5" />
          Sync Now
        </Button>
      </div>

      {/* Key Metrics Cards
      <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <Card className="walmart-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">12.5% vs last month</span>
                </div>
              </div>
              <div className="bg-primary-50 p-3 rounded-full">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="walmart-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Products</p>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">8.2% vs last month</span>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-full">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="walmart-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-red-500 mr-1 rotate-180" />
                  <span className="text-sm text-red-600">3.1% vs last month</span>
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="walmart-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-3xl font-bold text-gray-900">$0.0M</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">15.3% vs last month</span>
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div> */}

      {/* Main Content Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Items Uploaded Card */}
        <Card className="walmart-card">
          <CardHeader className="walmart-gradient text-white rounded-t-lg">
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Total Items Uploaded
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {totalItems.map((item) => (
                <div key={item.platform} className="flex justify-between items-center">
                  <span className="text-md text-gray-600">{item.platform}:</span>
                  <span className="font-bold text-lg text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Summary Card */}
        <Card className="walmart-card">
          <CardHeader className="bg-secondary text-gray-800 rounded-t-lg">
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Vendor App
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {vendorData.map((vendor) => (
                <div key={vendor.name} className="flex justify-between items-center">
                  <span className="text-md text-gray-600">{vendor.name}</span>
                  <span className="text-md font-semibold text-gray-900">{vendor.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Summary Card */}
        <Card className="walmart-card">
          <CardHeader className="bg-gray-200 text-gray-800 rounded-t-lg">
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Marketplace App
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {marketplaceData.map((marketplace) => (
                <div key={marketplace.name} className="flex justify-between items-center">
                  <span className="text-md text-gray-600">{marketplace.name}</span>
                  <span className="text-md font-semibold text-gray-900">{marketplace.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

