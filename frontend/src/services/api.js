import { API_BASE_URL } from '../lib/constants';

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Marketplace APIs
export const marketplaceAPI = {
  // Get all marketplaces
  getMarketplaces: () => apiCall('/marketplace/marketplaces'),
  
  // Get vendors (global)
  getVendors: () => apiCall('/vendor/vendors'),
  
  // Get all stores (summary)
  getStores: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.marketplace_id) queryParams.append('marketplace_id', params.marketplace_id);
    if (params.active_only !== undefined) queryParams.append('active_only', params.active_only);
    
    const queryString = queryParams.toString();
    return apiCall(`/marketplace/stores${queryString ? `?${queryString}` : ''}`);
  },
  
  // Get single store (full vendor settings)
  getStore: (storeId) => apiCall(`/marketplace/stores/${storeId}`),
  
  // Create store
  createStore: (storeData) => apiCall('/marketplace/stores', {
    method: 'POST',
    body: JSON.stringify(storeData),
  }),
  
  // Update store
  updateStore: (storeId, storeData) => apiCall(`/marketplace/stores/${storeId}`, {
    method: 'PUT',
    body: JSON.stringify(storeData),
  }),
  
  // Duplicate store
  duplicateStore: (storeId, data) => apiCall(`/marketplace/stores/${storeId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Set active flag only
  setStoreActive: (storeId, isActive) => apiCall(`/marketplace/stores/${storeId}/active`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  }),
  
  // Delete store
  deleteStore: (storeId) => apiCall(`/marketplace/stores/${storeId}`, {
    method: 'DELETE',
  }),
};

// Helper function to transform frontend data to API format (vendor arrays)
export const transformStoreDataForAPI = (storeInfo, priceSettingsByVendor, inventorySettingsByVendor) => {
  return {
    name: storeInfo.storeName,
    marketplace_id: parseInt(storeInfo.marketplace),
    api_key_enc: storeInfo.apiKey || "",
    price_settings_by_vendor: (priceSettingsByVendor || []).map(v => ({
      vendor_id: v.vendorId,
      purchase_tax_percentage: parseFloat(v.purchaseTax) || 0,
      marketplace_fees_percentage: parseFloat(v.marketplaceFees) || 0,
      price_ranges: (v.priceRanges || []).map(range => ({
        from_value: parseFloat(range.from) || 0,
        to_value: range.to || "MAX",
        margin_percentage: parseFloat(range.margin) || 0,
        minimum_margin_cents: ((parseInt(range.minimumMargin) || 0) * 100)
      }))
    })),
    inventory_settings_by_vendor: (inventorySettingsByVendor || []).map(v => ({
      vendor_id: v.vendorId,
      inventory_ranges: (v.priceRanges || []).map(range => ({
        from_value: parseFloat(range.from) || 0,
        to_value: range.to || "MAX",
        multiplier: parseFloat(range.multipliedWith) || 0
      }))
    }))
  };
};

// Helper function to transform API data to frontend format (vendor arrays)
export const transformStoreDataForFrontend = (apiStoreData) => {
  return {
    id: apiStoreData.id,
    name: apiStoreData.name,
    marketplace: apiStoreData.marketplace.name,
    marketplace_id: apiStoreData.marketplace.id,
    is_active: apiStoreData.is_active,
    created_at: apiStoreData.created_at,
    storeInfo: {
      storeName: apiStoreData.name,
      marketplace: apiStoreData.marketplace.id.toString(),
      apiKey: apiStoreData.api_key_enc,
    },
    priceSettingsByVendor: (apiStoreData.price_settings_by_vendor || []).map(s => ({
      vendorId: s.vendor_id,
      purchaseTax: s.purchase_tax_percentage.toString(),
      marketplaceFees: s.marketplace_fees_percentage.toString(),
      priceRanges: (s.price_ranges || []).map(range => ({
        from: range.from_value.toString(),
        to: range.to_value,
        margin: range.margin_percentage.toString(),
        minimumMargin: ((range.minimum_margin_cents || 0) / 100).toString()
      }))
    })),
    inventorySettingsByVendor: (apiStoreData.inventory_settings_by_vendor || []).map(s => ({
      vendorId: s.vendor_id,
      priceRanges: (s.inventory_ranges || []).map(range => ({
        from: range.from_value.toString(),
        to: range.to_value,
        multipliedWith: range.multiplier.toString()
      }))
    }))
  };
}; 