// Configuración global de la aplicación
export const CONFIG = {
  // URLs de API
  GAS_URL: "https://script.google.com/macros/s/AKfycbxZIPBOwj9LXVThkQkhYJcsTYEFccgEJlsOH3UyrgMg64axY3mFLU3qVxVXMiJI2zt4IQ/exec",
  PROXY_URL: "https://proxy-gas.srbyyeah.workers.dev/",
  CONNECTION_CHECK_URL: "https://httpbin.org/get",
  
  // Selectores DOM
  ELEMENTS: {
    loadingIndicator: "#loading-indicator",
    mainHeader: ".main-header",
    sectionTitle: ".section-title",
    ventasTable: "#ventasTable tbody",
    registrosTable: "#registrosTable tbody"
  },
  
  // Configuración de paginación
  PAGINATION: {
    registrosPorPagina: 10,
    maxPagesToShow: 5
  },
  
  // Tiempos (en ms)
  TIMEOUTS: {
    apiRequest: 8000,
    connectionCheck: 3000,
    alertDuration: 5000
  }
};

// Títulos de secciones
export const SECTION_TITLES = {
  vender: "Ventas",
  registros: "Registros",
  referencias: "Referencias",
  graficos: "Gráficos"
};

// Estilos
export const STYLES = {
  colors: {
    primary: "#C50000",
    secondary: "#E70000",
    background: "#FFFDEF",
    text: "#0a0a0a"
  },
  alertTypes: {
    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    info: "#2196F3"
  }
};