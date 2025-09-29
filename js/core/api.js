import { CONFIG } from './config.js';

export class ApiService {
  constructor() {
    this.baseUrl = CONFIG.PROXY_URL;
    this.timeout = CONFIG.TIMEOUTS.apiRequest;
  }

  async fetchWithTimeout(url, options = {}, timeout = this.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Respuesta no JSON: ${text.substring(0, 100)}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async fetchVentas(params = {}) {
    let url = `${this.baseUrl}?target=${encodeURIComponent(CONFIG.GAS_URL)}`;

    if (params.startDate || params.endDate) {
      url += `&startDate=${params.startDate || ''}&endDate=${params.endDate || ''}`;
    }

    console.log('Fetching URL:', url); 

    const response = await this.fetchWithTimeout(url);

    console.log('API Response:', response); 

    if (!response || !response.data || !Array.isArray(response.data)) {
      throw new Error('Formato de respuesta no válido');
    }

    return {
      data: response.data.map(row => {
        while (row.length < 8) row.push('');
        return row;
      })
    };
  }

  async sendVenta(data) {
    const ventaData = {
      ...data,
      _uniqueId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Target-URL': CONFIG.GAS_URL,
        'X-Request-ID': ventaData._uniqueId
      },
      body: JSON.stringify(ventaData)
    };

    return await this.fetchWithTimeout(this.baseUrl, options);
  }

  async checkConnection() {
    try {
      await this.fetchWithTimeout(
        CONFIG.CONNECTION_CHECK_URL,
        {},
        CONFIG.TIMEOUTS.connectionCheck
      );
      return true;
    } catch {
      return false;
    }
  }
}