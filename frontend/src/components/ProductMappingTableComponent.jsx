import "../styles/ProductMappingTable.css"

const ProductMappingTable = () => {
  const mockData = [
    {
      date: "2024-02-09",
      userName: "John Smith",
      vendorName: "Vendor A",
      marketplace: "Amazon",
      itemsUploaded: 100,
      itemsAdded: 95,
      status: "completed",
      errorLogs: "No errors",
    },
    {
      date: "2024-02-09",
      userName: "Sarah Johnson",
      vendorName: "Vendor B",
      marketplace: "eBay",
      itemsUploaded: 75,
      itemsAdded: 70,
      status: "pending",
      errorLogs: "Processing",
    },
    {
      date: "2024-02-08",
      userName: "Mike Wilson",
      vendorName: "Vendor C",
      marketplace: "Shopify",
      itemsUploaded: 50,
      itemsAdded: 45,
      status: "failed",
      errorLogs: "Invalid SKU format",
    },
  ]

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "badge-success"
      case "pending":
        return "badge-warning"
      case "failed":
        return "badge-error"
      default:
        return ""
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bulk Upload</h1>
        <button className="btn btn-primary bg-primary text-white hover:bg-primary/90">Upload</button>
      </div>
      
      <p className="description text-gray-600 mb-6">Please upload the excel file with one Vendor and Marketplace only.</p>

      <div className="table-container shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">User Name</th>
              <th className="py-3 px-4 text-left">Vendor Name</th>
              <th className="py-3 px-4 text-left">Marketplace</th>
              <th className="py-3 px-4 text-right">Items Uploaded</th>
              <th className="py-3 px-4 text-right">Items Added</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left">Error Logs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mockData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100">
                <td className="py-3 px-4">{row.date}</td>
                <td className="py-3 px-4">{row.userName}</td>
                <td className="py-3 px-4">{row.vendorName}</td>
                <td className="py-3 px-4">{row.marketplace}</td>
                <td className="py-3 px-4 text-right">{row.itemsUploaded}</td>
                <td className="py-3 px-4 text-right">{row.itemsAdded}</td>
                <td className="py-3 px-4">
                  <span className={`badge ${getStatusClass(row.status)}`}>{row.status}</span>
                </td>
                <td className="py-3 px-4">{row.errorLogs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProductMappingTable
