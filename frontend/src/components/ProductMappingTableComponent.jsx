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
    <div className="container">
      {/* Flex container for heading and button */}
      <div className="header">
        <h1>Bulk Upload</h1>
        <button className="btn btn-primary">Upload</button>
      </div>
      
      <p className="description">Please upload the excel file with one Vendor and Marketplace only.</p>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>User Name</th>
              <th>Vendor Name</th>
              <th>Marketplace</th>
              <th>Items Uploaded</th>
              <th>Items Added</th>
              <th>Status</th>
              <th>Error Logs</th>
            </tr>
          </thead>
          <tbody>
            {mockData.map((row, index) => (
              <tr key={index}>
                <td>{row.date}</td>
                <td>{row.userName}</td>
                <td>{row.vendorName}</td>
                <td>{row.marketplace}</td>
                <td className="text-right">{row.itemsUploaded}</td>
                <td className="text-right">{row.itemsAdded}</td>
                <td>
                  <span className={`badge ${getStatusClass(row.status)}`}>{row.status}</span>
                </td>
                <td>{row.errorLogs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProductMappingTable
