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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button>
          <Sync className="mr-2 h-4 w-4" />
          Sync Now
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Items Uploaded Card */}
        <Card>
          <CardHeader>
            <CardTitle>Total Items Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {totalItems.map((item) => (
                <div key={item.platform} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{item.platform}:</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor App</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vendorData.map((vendor) => (
                <div key={vendor.name} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{vendor.name}</span>
                  <span className="text-sm">{vendor.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Marketplace App</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {marketplaceData.map((marketplace) => (
                <div key={marketplace.name} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{marketplace.name}</span>
                  <span className="text-sm">{marketplace.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

