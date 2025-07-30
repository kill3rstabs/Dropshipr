import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { FolderSyncIcon as Sync } from "lucide-react"

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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Dashboard</h1>
        <Button className="bg-primary text-white hover:bg-primary/90">
          <Sync className="mr-2 h-5 w-5" />
          Sync Now
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Items Uploaded Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-primary text-white rounded-t-lg">
            <CardTitle>Total Items Uploaded</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {totalItems.map((item) => (
                <div key={item.platform} className="flex justify-between items-center">
                  <span className="text-md text-muted-foreground">{item.platform}:</span>
                  <span className="font-bold text-lg">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Summary Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-secondary text-gray-800 rounded-t-lg">
            <CardTitle>Vendor App</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {vendorData.map((vendor) => (
                <div key={vendor.name} className="flex justify-between items-center">
                  <span className="text-md text-muted-foreground">{vendor.name}</span>
                  <span className="text-md font-semibold">{vendor.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Summary Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-gray-200 text-gray-800 rounded-t-lg">
            <CardTitle>Marketplace App</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {marketplaceData.map((marketplace) => (
                <div key={marketplace.name} className="flex justify-between items-center">
                  <span className="text-md text-muted-foreground">{marketplace.name}</span>
                  <span className="text-md font-semibold">{marketplace.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

