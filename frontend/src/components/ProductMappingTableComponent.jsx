import { useState, useEffect } from "react"
import "../styles/ProductMappingTable.css"
import { API_BASE_URL } from "../lib/constants.js"

const ProductMappingTable = () => {
  const [uploads, setUploads] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [deletingUploadId, setDeletingUploadId] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, upload: null })
  
  // New states for template modal
  const [templateModal, setTemplateModal] = useState({ isOpen: false })
  const [selectedTemplate, setSelectedTemplate] = useState('upload')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // Export loading state
  const [isExporting, setIsExporting] = useState(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 10,
    total_count: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  })

  // Fetch uploads on component mount and when pagination changes
  useEffect(() => {
    fetchUploads()
  }, [currentPage, pageSize])

  // Handle keyboard events and body scroll for modals
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (deleteModal.isOpen) {
          closeDeleteModal()
        }
        if (templateModal.isOpen) {
          closeTemplateModal()
        }
      }
    }

    if (deleteModal.isOpen || templateModal.isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [deleteModal.isOpen, templateModal.isOpen])

  // Template modal functions
  const openTemplateModal = () => {
    setTemplateModal({ isOpen: true })
  }

  const closeTemplateModal = (preserveMessages = false) => {
    setTemplateModal({ isOpen: false })
    setSelectedTemplate('upload')
    setDragOver(false)
    setSelectedFile(null)
    
    // Only clear messages if not preserving them (for manual close)
    if (!preserveMessages) {
      setError(null)
      setSuccess(null)
    }
  }

  // CSV template generation
  const generateUploadTemplate = () => {
    const headers = [
      'Vendor Name',
      'Vendor ID', 
      'Is Variation',
      'Variation ID',
      'Marketplace Name',
      'Store Name',
      'Marketplace Parent SKU',
      'Marketplace Child SKU',
      'Marketplace ID'
    ]
    return headers.join(',') + '\n'
  }

  const generateDeleteTemplate = () => {
    const headers = ['Child sku', 'store name']
    return headers.join(',') + '\n'
  }

  // Download template function
  const downloadTemplate = (type) => {
    const csvContent = type === 'upload' ? generateUploadTemplate() : generateDeleteTemplate()
    const fileName = type === 'upload' ? 'product_upload_template.csv' : 'product_delete_template.csv'
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Download current products function
  const downloadCurrentProducts = async () => {
    try {
      setIsExporting(true)
      setError(null) // Clear any previous errors
      
      const response = await fetch(`${API_BASE_URL}/products/export/`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'system_products.csv'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        // Show success message
        setSuccess('Products exported successfully!')
      } else {
        setError('Failed to export products')
      }
    } catch (error) {
      console.error('Export error:', error)
      setError('Export failed. Please check your connection and try again.')
    } finally {
      setIsExporting(false)
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      setIsUploading(true)
      setUploadProgress(0)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch(`${API_BASE_URL}/products/bulk-delete/`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (result.success) {
        setSuccess(`Bulk delete completed! ${result.deletedCount || 0} products deleted.`)
        // Refresh uploads to reflect changes
        setTimeout(() => {
          setCurrentPage(1) // Reset to first page
          fetchUploads()
        }, 1000)
        
        // Close modal after success
        closeTemplateModal(true)
      } else {
        setError(getErrorMessage(result))
        
        // Close modal after error
        setTimeout(() => {
          closeTemplateModal(true)
        }, 3000) // Give user time to read error message
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      setError('Bulk delete failed. Please check your connection and try again.')
      
      // Close modal after error
      setTimeout(() => {
        closeTemplateModal(true)
      }, 3000) // Give user time to read error message
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      
      // Clear messages after 8 seconds
      setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 8000)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  // Handle file selection (not upload yet)
  const handleFileSelection = (file) => {
    if (!file) return

    // Clear previous messages
    setError(null)
    setSuccess(null)

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // Set the selected file for preview
    setSelectedFile(file)
    
    // Clear the file input to allow selecting the same file again
    const fileInput = document.getElementById('file-upload')
    if (fileInput) {
      fileInput.value = ''
    }
  }

  // Handle the actual upload when user clicks upload button
  const handleConfirmUpload = async () => {
    if (!selectedFile) return
    
    if (selectedTemplate === 'upload') {
      await handleFileUploadLogic(selectedFile)
    } else {
      await handleBulkDelete(selectedFile)
    }
    
    // Clear the selected file after upload
    setSelectedFile(null)
  }

  // Extract upload logic to reuse
  const handleFileUploadLogic = async (file) => {
    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch(`${API_BASE_URL}/products/upload/`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (result.success) {
        // Add new upload to the beginning of the list
        setUploads(prevUploads => [result, ...prevUploads])
        
        // Update success message to reflect the uploaded status
        const statusMessage = result.status === "uploaded" 
          ? `File "${file.name}" uploaded successfully! ${result.itemsAdded} products added. Scraping will begin shortly.`
          : `File "${file.name}" processed successfully! ${result.itemsAdded} items added.`
        
        setSuccess(statusMessage)
        
        // Refresh the uploads list to get updated data
        setTimeout(() => {
          setCurrentPage(1) // Reset to first page
          fetchUploads()
        }, 1000)
        
        // Close modal after success
        closeTemplateModal(true)
      } else {
        // Use the enhanced error message function
        setError(getErrorMessage(result))
        
        // Close modal after error
        setTimeout(() => {
          closeTemplateModal(true)
        }, 3000) // Give user time to read error message
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError('Upload failed. Please check your connection and try again.')
      
      // Close modal after error
      setTimeout(() => {
        closeTemplateModal(true)
      }, 3000) // Give user time to read error message
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      
      // Clear messages after 10 seconds for validation errors (longer read time)
      setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 10000)
    }
  }

  const fetchUploads = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/uploads/?page=${currentPage}&page_size=${pageSize}`)
      const data = await response.json()
      
      if (data.success) {
        setUploads(data.uploads || [])
        setPagination(data.pagination || {
          current_page: 1,
          page_size: 10,
          total_count: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        })
      } else {
        setError('Failed to fetch upload history')
      }
    } catch (error) {
      console.error('Error fetching uploads:', error)
      setError('Failed to fetch upload history')
    }
  }

  const validateFile = (file) => {
    // Check file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    const allowedExtensions = ['.csv', '.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return 'Please upload a CSV or Excel file only.'
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB.'
    }

    return null
  }

  const getErrorMessage = (result) => {
    if (!result.error) return 'Unknown error occurred'
    
    const { error, errorType, details } = result
    
    switch (errorType) {
      case 'INVALID_FILE_TYPE':
        return 'Invalid file type. Please upload CSV or Excel files only.'
        
      case 'FILE_PARSING_ERROR':
        return `File parsing error: ${error}. Please check your file format and try again.`
        
      case 'MISSING_COLUMNS':
        return `Missing required columns: ${error}. Please ensure your file has all required columns: Vendor Name, Vendor ID, Marketplace Name, Store Name, Marketplace Child SKU.`
        
      case 'EMPTY_REQUIRED_FIELDS':
        return `Empty required fields found: ${error}. Please fill in all required data before uploading.`
        
      case 'ENTITY_NOT_FOUND':
        return `Database validation failed: ${error}. Please ensure all vendors, marketplaces, and stores exist in the system before uploading.`
        
      case 'DUPLICATE_SKU_STORE':
        return `Duplicate SKU validation failed: ${error}. Each combination of Marketplace Child SKU + Store Name must be unique.`
        
      case 'INCOMPLETE_STORE_SETTINGS':
        return `Store configuration incomplete: ${error}. Please ensure all stores have proper price and inventory settings configured.`
        
      case 'PROCESSING_ERROR':
        return `Processing failed: ${error}. The file was rejected to maintain data integrity.`
        
      default:
        return `Upload failed: ${error}`
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "badge-success"
      case "uploaded":  // Add specific styling for uploaded
        return "badge-info"
      case "pending":
        return "badge-warning"
      case "failed":
        return "badge-error"
      default:
        return ""
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-700 bg-green-100"
      case "uploaded":  // Add specific color for uploaded
        return "text-blue-700 bg-blue-100"
      case "pending":
        return "text-yellow-700 bg-yellow-100"
      case "failed":
        return "text-red-700 bg-red-100"
      default:
        return "text-gray-700 bg-gray-100"
    }
  }

  const getStatusDisplay = (status) => {
    switch (status) {
      case "completed":
        return "Completed" // All items scraped
      case "uploaded":
        return "Uploaded" // File uploaded, products created, scraping pending
      case "pending":
        return "Pending"
      case "failed":
        return "Failed"
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const openDeleteModal = (upload) => {
    setDeleteModal({ isOpen: true, upload })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, upload: null })
  }

  const confirmDelete = async () => {
    const uploadId = deleteModal.upload.id

    setDeletingUploadId(uploadId)
    setError(null)
    setSuccess(null)
    closeDeleteModal()

    try {
      const response = await fetch(`${API_BASE_URL}/products/upload/${uploadId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // Remove the deleted upload from the list
        setUploads(prevUploads => prevUploads.filter(upload => upload.id !== uploadId))
        
        // Show success message
        if (result.partial) {
          setSuccess(`${result.message} - ${result.summary.products_deleted} products deleted.`)
          if (result.warnings && result.warnings.length > 0) {
            console.warn('Deletion warnings:', result.warnings)
          }
        } else {
          setSuccess(result.message)
        }
      } else {
        setError(`Delete failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      setError('Delete failed. Please check your connection and try again.')
    } finally {
      setDeletingUploadId(null)
      
      // Clear messages after 8 seconds
      setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 8000)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bulk Upload</h1>
        <div className="flex items-center gap-4">
          {isUploading && (
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600">{uploadProgress}%</span>
            </div>
          )}
          <button
            onClick={openTemplateModal}
            className={`btn btn-primary bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isUploading}
          >
            {isUploading ? 'Processing...' : 'Update with file'}
          </button>
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <strong>Success:</strong> {success}
        </div>
      )}
      
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-gray-700 mb-2">
          <strong>Instructions:</strong> Please upload a CSV or Excel file with product mapping data.
        </p>
        <p className="text-sm text-gray-600">
          <strong>Required columns:</strong> Vendor Name, Vendor ID, Marketplace Name, Store Name, Marketplace Child SKU
        </p>
        <p className="text-sm text-gray-600">
          <strong>Optional columns:</strong> Is Variation, Variation ID, Marketplace Parent SKU, Marketplace ID
        </p>
        <p className="text-sm text-gray-600">
          <strong>Supported formats:</strong> CSV (.csv), Excel (.xlsx, .xls) | <strong>Max size:</strong> 10MB
        </p>
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800 font-semibold mb-1">Validation Requirements:</p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
            <li>All vendors, marketplaces, and stores must exist in the system</li>
            <li>Each SKU + Store combination must be unique (within file and database)</li>
            <li>All stores must have complete price and inventory settings configured</li>
            <li>File will be completely rejected if any validation fails</li>
          </ul>
          <p className="text-sm text-yellow-800 font-semibold mt-2 mb-1">Status Flow:</p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
            <li><span className="font-semibold">Uploaded:</span> File processed, products created, scraping pending</li>
            <li><span className="font-semibold">Completed:</span> All products have been scraped</li>
          </ul>
        </div>
      </div>

      <div className="table-container shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              <th className="py-3 px-4 text-left font-semibold">Date</th>
              <th className="py-3 px-4 text-left font-semibold">User Name</th>
              <th className="py-3 px-4 text-left font-semibold">Vendor Name</th>
              <th className="py-3 px-4 text-left font-semibold">Marketplace</th>
              <th className="py-3 px-4 text-right font-semibold">Items Added</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Error Logs</th>
              <th className="py-3 px-4 text-center font-semibold w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {uploads.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 px-4 text-center text-gray-500">
                  No uploads yet. Upload your first file to get started!
                </td>
              </tr>
            ) : (
              uploads.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">{row.date}</td>
                  <td className="py-3 px-4">{row.userName}</td>
                  <td className="py-3 px-4 font-medium">{row.vendorName}</td>
                  <td className="py-3 px-4 font-medium">{row.marketplace}</td>
                  <td className="py-3 px-4 text-right font-semibold">{row.itemsAdded}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(row.status)}`}>
                      {getStatusDisplay(row.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="max-w-xs truncate" title={row.errorLogs}>
                      {row.errorLogs}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => openDeleteModal(row)}
                      disabled={deletingUploadId === row.id}
                      className={`relative p-2 rounded-lg transition-all duration-200 ${
                        deletingUploadId === row.id
                          ? 'bg-gray-100 cursor-not-allowed'
                          : 'text-red-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50'
                      }`}
                      title={deletingUploadId === row.id ? 'Deleting...' : 'Delete upload and all associated products'}
                    >
                      {deletingUploadId === row.id ? (
                        <div className="flex items-center justify-center w-5 h-5">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                        </div>
                      ) : (
                        <svg 
                          className="w-5 h-5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {pagination.total_count > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Page Info */}
          <div className="text-sm text-gray-600">
            Showing {((pagination.current_page - 1) * pagination.page_size) + 1} to {Math.min(pagination.current_page * pagination.page_size, pagination.total_count)} of {pagination.total_count} uploads
          </div>
          
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm text-gray-600">Show:</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1) // Reset to first page when changing page size
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
          
          {/* Pagination Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={!pagination.has_prev}
              className={`px-3 py-1 rounded text-sm ${
                !pagination.has_prev
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              First
            </button>
            
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!pagination.has_prev}
              className={`px-3 py-1 rounded text-sm ${
                !pagination.has_prev
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!pagination.has_next}
              className={`px-3 py-1 rounded text-sm ${
                !pagination.has_next
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
            
            <button
              onClick={() => setCurrentPage(pagination.total_pages)}
              disabled={!pagination.has_next}
              className={`px-3 py-1 rounded text-sm ${
                !pagination.has_next
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={closeDeleteModal}
        >
          <div 
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-2xl bg-white transform transition-all duration-300 ease-out scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <svg 
                  className="w-8 h-8 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
              </div>
            </div>

            {/* Modal Title */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Confirm Deletion
              </h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this upload?
              </p>
            </div>

            {/* Upload Details */}
            {deleteModal.upload && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    Upload from {deleteModal.upload.date}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Vendor:</span>
                    <span className="font-medium">{deleteModal.upload.vendorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Marketplace:</span>
                    <span className="font-medium">{deleteModal.upload.marketplace}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Items Added:</span>
                    <span className="font-medium">{deleteModal.upload.itemsAdded}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm">
                  <p className="text-amber-800 font-medium">This will permanently delete:</p>
                  <ul className="mt-1 text-amber-700 list-disc list-inside">
                    <li>The uploaded file</li>
                    <li>All products created by this upload</li>
                    <li>Related vendor prices</li>
                  </ul>
                  <p className="mt-2 text-amber-800 font-medium">This action cannot be undone.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between space-x-4">
              <button
                onClick={closeDeleteModal}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Delete Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Upload Modal */}
      {templateModal.isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={closeTemplateModal}
        >
          <div 
            className="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-lg bg-white transform transition-all duration-300 ease-out scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Update with file
              </h3>
              <button
                onClick={closeTemplateModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Select a file template type to upload or download a template.
            </p>

            {/* Template Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value)
                  setSelectedFile(null) // Reset selected file when template changes
                }}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="upload">Upload Products</option>
                <option value="delete">Delete Products</option>
              </select>
            </div>

            {/* File Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                selectedFile
                  ? 'border-green-300 bg-green-50'
                  : dragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <>
                  <svg className="w-12 h-12 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-green-600 font-medium mb-2">File Ready for {selectedTemplate === 'upload' ? 'Upload' : 'Delete'}</p>
                  <p className="text-sm text-green-500">{selectedFile.name}</p>
                </>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  
                  <div className="mb-2">
                    <span className="text-blue-600 hover:text-blue-500 cursor-pointer font-medium">
                      Drag and drop a file or browse
                    </span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleFileSelection(e.target.files[0])}
                      className="hidden"
                      id="file-upload"
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="ml-1 text-blue-600 hover:text-blue-500 cursor-pointer font-medium underline"
                    >
                      browse
                    </label>
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-1">
                    1 file at a time • CSV/XLSX format • 10 MB max
                  </p>
                  <p className="text-xs text-blue-600">
                    Selected: {selectedTemplate === 'upload' ? 'Product Upload' : 'Product Delete'} Template
                  </p>
                </>
              )}
            </div>

            {/* Selected File Preview and Upload Button */}
            {selectedFile && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-green-800">File Selected</p>
                      <p className="text-xs text-green-600">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title="Remove file"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Upload Button */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleConfirmUpload}
                    disabled={isUploading}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      isUploading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : selectedTemplate === 'upload'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isUploading 
                      ? 'Processing...' 
                      : selectedTemplate === 'upload' 
                        ? 'Upload Products' 
                        : 'Delete Products'
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Template Downloads */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Download Templates</h4>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => downloadTemplate('upload')}
                  className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Upload Template</div>
                    <div className="text-xs text-gray-500">Product upload format</div>
                  </div>
                </button>
                
                <button
                  onClick={() => downloadTemplate('delete')}
                  className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Delete Template</div>
                    <div className="text-xs text-gray-500">Bulk delete format</div>
                  </div>
                </button>

                <button
                  onClick={downloadCurrentProducts}
                  disabled={isExporting}
                  className={`flex items-center p-3 border border-gray-300 rounded-lg transition-colors text-left ${
                    isExporting 
                      ? 'bg-gray-100 cursor-not-allowed' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {isExporting ? (
                    <svg className="w-5 h-5 text-green-500 mr-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {isExporting ? 'Exporting...' : 'Export Products'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {isExporting ? 'Please wait...' : 'All system products'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductMappingTable
