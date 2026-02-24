// ============================================================
// FILE: frontend/src/utils/api.js
// Complete API service for Serbia Land Registry
// ============================================================

// const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const _raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const BASE_URL = _raw.endsWith('/api') ? _raw : _raw + '/api';
const fetchAPI = async (endpoint, options = {}) => {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

// ────────────────────────────────────────────────────────────
// DASHBOARD ENDPOINTS
// ────────────────────────────────────────────────────────────

export const getDashboardStats = (region = '', timeRange = '') =>
  fetchAPI(`/dashboard/stats?region=${region}&timeRange=${timeRange}`);

export const getRegionalData = () =>
  fetchAPI('/dashboard/regional-data');

export const getFraudStats = (region = '') =>
  fetchAPI(`/dashboard/fraud-stats${region ? `?region=${encodeURIComponent(region)}` : ''}`);

export const getTrends = (metric = 'transfers', period = '30days', region = '') =>
  fetchAPI(`/dashboard/trends?metric=${metric}&period=${period}&region=${region}`);

export const getAffordabilityData = (region = '') =>
  fetchAPI(`/dashboard/affordability?region=${region}`);

export const getSubsidyData = (region = '', year = '') =>
  fetchAPI(`/dashboard/subsidy?region=${region}&year=${year}`);

export const getBubbleRiskData = (region = '') =>
  fetchAPI(`/dashboard/bubble-risk?region=${region}`);

// ────────────────────────────────────────────────────────────
// PARCELS, DISPUTES, TRANSFERS, MORTGAGES
// ────────────────────────────────────────────────────────────

export const getParcels = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/parcels?${query}`);
};

export const getParcelById = (id) => fetchAPI(`/parcels/${id}`);

export const getDisputes = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/disputes?${query}`);
};

export const getDisputeById = (id) => fetchAPI(`/disputes/${id}`);

export const getTransfers = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/transfers?${query}`);
};

export const getTransferById = (id) => fetchAPI(`/transfers/${id}`);

export const getMortgages = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/mortgages?${query}`);
};

export const getMortgageById = (id) => fetchAPI(`/mortgages/${id}`);

export const getOwners = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/owners?${query}`);
};

// ────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────────────────────────

export const formatCurrency = (value, currency = 'EUR') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (num) => {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};


// ────────────────────────────────────────────────────────────
// LEGACY ALIASES (fetch* names used by LegalCleanliness, Subsidy, BubbleRisk)
// ────────────────────────────────────────────────────────────
export const fetchDashboardStats = getDashboardStats;
export const fetchAffordabilityData = getAffordabilityData;
export const fetchSubsidyData = getSubsidyData;
export const fetchBubbleRiskData = getBubbleRiskData;
export const fetchRegionalData = getRegionalData;
export const fetchParcels = getParcels;
export const fetchDisputes = getDisputes;
export const fetchDisputeStats = (region = '') =>
  fetchAPI(`/disputes/stats/summary${region ? `?region=${region}` : ''}`);
export const fetchTransfers = getTransfers;
export const fetchMortgages = getMortgages;

export default {
  getDashboardStats,
  getRegionalData,
  getTrends,
  getAffordabilityData,
  getSubsidyData,
  getBubbleRiskData,
  getParcels,
  getParcelById,
  getDisputes,
  getDisputeById,
  getTransfers,
  getTransferById,
  getMortgages,
  getMortgageById,
  getOwners,
  formatCurrency,
  formatNumber,
};

// // ============================================================
// // FILE: frontend/src/utils/api.js
// // Complete API service for Serbia Land Registry
// // ============================================================

// // const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// const _raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
// const BASE_URL = _raw.endsWith('/api') ? _raw : _raw + '/api';
// const fetchAPI = async (endpoint, options = {}) => {
//   try {
//     const res = await fetch(`${BASE_URL}${endpoint}`, {
//       headers: { 'Content-Type': 'application/json' },
//       ...options,
//     });
    
//     if (!res.ok) {
//       const errorData = await res.json().catch(() => ({}));
//       throw new Error(errorData.message || `API error: ${res.status}`);
//     }
    
//     return res.json();
//   } catch (error) {
//     console.error(`API Error [${endpoint}]:`, error);
//     throw error;
//   }
// };

// // ────────────────────────────────────────────────────────────
// // DASHBOARD ENDPOINTS
// // ────────────────────────────────────────────────────────────

// export const getDashboardStats = (region = '', timeRange = '') =>
//   fetchAPI(`/dashboard/stats?region=${region}&timeRange=${timeRange}`);

// export const getRegionalData = () =>
//   fetchAPI('/dashboard/regional-data');

// export const getTrends = (metric = 'transfers', period = '30days', region = '') =>
//   fetchAPI(`/dashboard/trends?metric=${metric}&period=${period}&region=${region}`);

// export const getAffordabilityData = (region = '') =>
//   fetchAPI(`/dashboard/affordability?region=${region}`);

// export const getSubsidyData = (region = '', year = '') =>
//   fetchAPI(`/dashboard/subsidy?region=${region}&year=${year}`);

// export const getBubbleRiskData = (region = '') =>
//   fetchAPI(`/dashboard/bubble-risk?region=${region}`);

// // ────────────────────────────────────────────────────────────
// // PARCELS, DISPUTES, TRANSFERS, MORTGAGES
// // ────────────────────────────────────────────────────────────

// export const getParcels = (params = {}) => {
//   const query = new URLSearchParams(params).toString();
//   return fetchAPI(`/parcels?${query}`);
// };

// export const getParcelById = (id) => fetchAPI(`/parcels/${id}`);

// export const getDisputes = (params = {}) => {
//   const query = new URLSearchParams(params).toString();
//   return fetchAPI(`/disputes?${query}`);
// };

// export const getDisputeById = (id) => fetchAPI(`/disputes/${id}`);

// export const getTransfers = (params = {}) => {
//   const query = new URLSearchParams(params).toString();
//   return fetchAPI(`/transfers?${query}`);
// };

// export const getTransferById = (id) => fetchAPI(`/transfers/${id}`);

// export const getMortgages = (params = {}) => {
//   const query = new URLSearchParams(params).toString();
//   return fetchAPI(`/mortgages?${query}`);
// };

// export const getMortgageById = (id) => fetchAPI(`/mortgages/${id}`);

// export const getOwners = (params = {}) => {
//   const query = new URLSearchParams(params).toString();
//   return fetchAPI(`/owners?${query}`);
// };

// // ────────────────────────────────────────────────────────────
// // UTILITY FUNCTIONS
// // ────────────────────────────────────────────────────────────

// export const formatCurrency = (value, currency = 'EUR') => {
//   return new Intl.NumberFormat('en-US', {
//     style: 'currency',
//     currency,
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 2,
//   }).format(value);
// };

// export const formatNumber = (num) => {
//   if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
//   if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
//   if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
//   return num.toString();
// };


// // ────────────────────────────────────────────────────────────
// // LEGACY ALIASES (fetch* names used by LegalCleanliness, Subsidy, BubbleRisk)
// // ────────────────────────────────────────────────────────────
// export const fetchDashboardStats = getDashboardStats;
// export const fetchAffordabilityData = getAffordabilityData;
// export const fetchSubsidyData = getSubsidyData;
// export const fetchBubbleRiskData = getBubbleRiskData;
// export const fetchRegionalData = getRegionalData;
// export const fetchParcels = getParcels;
// export const fetchDisputes = getDisputes;
// export const fetchDisputeStats = (region = '') =>
//   fetchAPI(`/disputes/stats/summary${region ? `?region=${region}` : ''}`);
// export const fetchTransfers = getTransfers;
// export const fetchMortgages = getMortgages;

// export default {
//   getDashboardStats,
//   getRegionalData,
//   getTrends,
//   getAffordabilityData,
//   getSubsidyData,
//   getBubbleRiskData,
//   getParcels,
//   getParcelById,
//   getDisputes,
//   getDisputeById,
//   getTransfers,
//   getTransferById,
//   getMortgages,
//   getMortgageById,
//   getOwners,
//   formatCurrency,
//   formatNumber,
// };

// // src/utils/api.js
// // Centralized API utility for Serbia Land Registry

// const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// // Helper function for making API requests
// async function apiFetch(endpoint, options = {}) {
//   const token = localStorage.getItem('token');
//   const headers = {
//     'Content-Type': 'application/json',
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//     ...options.headers,
//   };

//   const response = await fetch(`${API_BASE}${endpoint}`, {
//     ...options,
//     headers,
//   });

//   if (!response.ok) {
//     const error = await response.json().catch(() => ({ message: 'Network error' }));
//     throw new Error(error.message || `HTTP error! status: ${response.status}`);
//   }

//   return response.json();
// }

// // ─── Dashboard Stats ───────────────────────────────────────────────────────────
// export async function fetchDashboardStats(region = '', timeRange = '') {
//   const params = new URLSearchParams();
//   if (region && region !== 'All Regions') params.set('region', region);
//   if (timeRange) params.set('timeRange', timeRange);
//   const query = params.toString() ? `?${params}` : '';
//   return apiFetch(`/dashboard/stats${query}`);
// }

// // ─── Affordability ─────────────────────────────────────────────────────────────
// export async function fetchAffordabilityData(region = '') {
//   const params = new URLSearchParams();
//   if (region && region !== 'All Regions') params.set('region', region);
//   const query = params.toString() ? `?${params}` : '';
//   return apiFetch(`/dashboard/affordability${query}`);
// }

// // ─── Subsidy ───────────────────────────────────────────────────────────────────
// export async function fetchSubsidyData(region = '', year = '') {
//   const params = new URLSearchParams();
//   if (region && region !== 'All Regions') params.set('region', region);
//   if (year) params.set('year', year);
//   const query = params.toString() ? `?${params}` : '';
//   return apiFetch(`/dashboard/subsidy${query}`);
// }

// // ─── Bubble Risk ───────────────────────────────────────────────────────────────
// export async function fetchBubbleRiskData(region = '') {
//   const params = new URLSearchParams();
//   if (region && region !== 'All Regions') params.set('region', region);
//   const query = params.toString() ? `?${params}` : '';
//   return apiFetch(`/dashboard/bubble-risk${query}`);
// }

// // ─── Regional Data ─────────────────────────────────────────────────────────────
// export async function fetchRegionalData() {
//   return apiFetch('/dashboard/regional-data');
// }

// // ─── Parcels ───────────────────────────────────────────────────────────────────
// export async function fetchParcels(params = {}) {
//   const query = new URLSearchParams(params).toString();
//   return apiFetch(`/parcels${query ? `?${query}` : ''}`);
// }

// export async function fetchParcelById(id) {
//   return apiFetch(`/parcels/${id}`);
// }

// // ─── Owners ────────────────────────────────────────────────────────────────────
// export async function fetchOwners(params = {}) {
//   const query = new URLSearchParams(params).toString();
//   return apiFetch(`/owners${query ? `?${query}` : ''}`);
// }

// // ─── Disputes ──────────────────────────────────────────────────────────────────
// export async function fetchDisputes(params = {}) {
//   const query = new URLSearchParams(params).toString();
//   return apiFetch(`/disputes${query ? `?${query}` : ''}`);
// }

// export async function fetchDisputeStats(region = '') {
//   const params = new URLSearchParams();
//   if (region && region !== 'All Regions') params.set('region', region);
//   const query = params.toString() ? `?${params}` : '';
//   return apiFetch(`/disputes/stats/summary${query}`);
// }

// // ─── Transfers ─────────────────────────────────────────────────────────────────
// export async function fetchTransfers(params = {}) {
//   const query = new URLSearchParams(params).toString();
//   return apiFetch(`/transfers${query ? `?${query}` : ''}`);
// }

// // ─── Mortgages ─────────────────────────────────────────────────────────────────
// export async function fetchMortgages(params = {}) {
//   const query = new URLSearchParams(params).toString();
//   return apiFetch(`/mortgages${query ? `?${query}` : ''}`);
// }

// // ─── Trends ────────────────────────────────────────────────────────────────────
// export async function fetchTrends(metric = 'transfers', period = '30days', region = '') {
//   const params = new URLSearchParams({ metric, period });
//   if (region && region !== 'All Regions') params.set('region', region);
//   return apiFetch(`/dashboard/trends?${params}`);
// }

// // ─── Auth ──────────────────────────────────────────────────────────────────────
// export async function loginUser(email, password) {
//   return apiFetch('/auth/login', {
//     method: 'POST',
//     body: JSON.stringify({ email, password }),
//   });
// }

// export async function registerUser(userData) {
//   return apiFetch('/auth/register', {
//     method: 'POST',
//     body: JSON.stringify(userData),
//   });
// }

// export default apiFetch;