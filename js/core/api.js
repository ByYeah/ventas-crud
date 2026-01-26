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

    // Añadir otros parámetros si existen
    if (params.liquidado !== undefined) {
      url += `&liquidado=${params.liquidado}`;
    }
    if (params.producto) {
      url += `&producto=${encodeURIComponent(params.producto)}`;
    }

    console.log('Fetching URL:', url);

    const response = await this.fetchWithTimeout(url);

    console.log('API Response:', response);

    // El response ya es directamente el array de datos
    if (!response || !response.data || !Array.isArray(response.data)) {
      throw new Error('Formato de respuesta no válido');
    }

    return {
      data: response.data.map(row => {
        while (row.length < 9) row.push(''); // Asegurar 9 columnas (ahora incluye liquidado)
        return row;
      })
    };
  }

  // Nuevo método para obtener los últimos N registros
  async fetchUltimosVentas(limite = 5) {
    const url = `${this.baseUrl}?target=${encodeURIComponent(CONFIG.GAS_URL)}&path=ultimos&limite=${limite}`;

    console.log('Fetching últimos URL:', url);

    const response = await this.fetchWithTimeout(url);

    console.log('API Últimos Response:', response);

    if (!response || !response.data || !Array.isArray(response.data)) {
      throw new Error('Formato de respuesta no válido para últimos registros');
    }

    return {
      data: response.data.map(row => {
        while (row.length < 9) row.push(''); // Asegurar 9 columnas
        return row;
      })
    };
  }

  async sendVenta(data) {
    // Para registrar venta, usar el endpoint base sin path
    const ventaData = {
      ...data,
      _uniqueId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Target-URL': CONFIG.GAS_URL
      },
      body: JSON.stringify(ventaData)
    };

    // Usar el URL base para ventas (sin path)
    const url = `${this.baseUrl}?target=${encodeURIComponent(CONFIG.GAS_URL)}`;

    return await this.fetchWithTimeout(url, options);
  }

  // Nuevo método para hacer POST requests con rutas
  async post(endpoint, data) {
    const url = `${this.baseUrl}?target=${encodeURIComponent(CONFIG.GAS_URL)}&path=${endpoint.substring(1)}`; // Remover / inicial

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Target-URL': CONFIG.GAS_URL
      },
      body: JSON.stringify(data)
    };

    console.log('POST URL:', url);
    console.log('POST Data:', data);

    return await this.fetchWithTimeout(url, options);
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

async deleteVenta(id) {
    // Construimos la URL con el parámetro 'path=eliminar' y el 'id'
    // Importante: Usar CONFIG.GAS_URL que es la que ya tienes probada
    const gasUrl = CONFIG.GAS_URL; 
    const targetUrl = `${gasUrl}?path=eliminar&id=${encodeURIComponent(id)}`;
    
    // El proxy espera el target codificado
    const url = `${this.baseUrl}?target=${encodeURIComponent(targetUrl)}`;

    console.log("Enviando petición de eliminación a:", url);

    const options = {
        method: 'POST', // Google Apps Script doPost manejará esto
        headers: {
            'Accept': 'application/json'
        }
    };

    return await this.fetchWithTimeout(url, options);
}
}