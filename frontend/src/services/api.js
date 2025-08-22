const API_BASE_URL = '/api';

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
  
  // Get all stores
  getStores: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.marketplace_id) queryParams.append('marketplace_id', params.marketplace_id);
    if (params.active_only !== undefined) queryParams.append('active_only', params.active_only);
    
    const queryString = queryParams.toString();
    return apiCall(`/marketplace/stores${queryString ? `?${queryString}` : ''}`);
  },
  
  // Get single store
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
  
  // Delete store
  deleteStore: (storeId) => apiCall(`/marketplace/stores/${storeId}`, {
    method: 'DELETE',
  }),
};

// Helper function to transform frontend data to API format
export const transformStoreDataForAPI = (storeInfo, priceSettings, inventorySettings) => {
  return {
    name: storeInfo.storeName,
    marketplace_id: parseInt(storeInfo.marketplace),
    api_key_enc: storeInfo.apiKey || "",
    price_settings: {
      purchase_tax_percentage: parseFloat(priceSettings.purchaseTax) || 0,
      marketplace_fees_percentage: parseFloat(priceSettings.marketplaceFees) || 0,
      price_ranges: priceSettings.priceRanges.map(range => ({
        from_value: parseFloat(range.from) || 0,
        to_value: range.to || "MAX",
        margin_percentage: parseFloat(range.margin) || 0,
        minimum_margin_cents: parseInt(range.minimumMargin) * 100 || 0
      }))
    },
    inventory_settings: {
      inventory_ranges: inventorySettings.priceRanges.map(range => ({
        from_value: parseFloat(range.from) || 0,
        to_value: range.to || "MAX",
        multiplier: parseFloat(range.multipliedWith) || 0
      }))
    }
  };
};

// Helper function to transform API data to frontend format
export const transformStoreDataForFrontend = (apiStoreData) => {
  return {
    id: apiStoreData.id,
    name: apiStoreData.name,
    marketplace: apiStoreData.marketplace.name,
    marketplace_id: apiStoreData.marketplace.id,
    is_active: apiStoreData.is_active,
    scraping_enabled: apiStoreData.scraping_enabled,
    scraping_interval_hours: apiStoreData.scraping_interval_hours,
    price_update_enabled: apiStoreData.price_update_enabled,
    created_at: apiStoreData.created_at,
    storeInfo: {
      storeName: apiStoreData.name,
      marketplace: apiStoreData.marketplace.id.toString(),
      apiKey: apiStoreData.api_key_enc,
    },
    priceSettings: {
      purchaseTax: apiStoreData.price_settings.purchase_tax_percentage.toString(),
      marketplaceFees: apiStoreData.price_settings.marketplace_fees_percentage.toString(),
      priceRanges: apiStoreData.price_settings.price_ranges.map(range => ({
        from: range.from_value.toString(),
        to: range.to_value,
        margin: range.margin_percentage.toString(),
        minimumMargin: (range.minimum_margin_cents / 100).toString()
      }))
    },
    inventorySettings: {
      priceRanges: apiStoreData.inventory_settings.inventory_ranges.map(range => ({
        from: range.from_value.toString(),
        to: range.to_value,
        multipliedWith: range.multiplier.toString()
      }))
    }
  };
}; 