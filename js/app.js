// Importaciones de módulos
import { CONFIG, SECTION_TITLES } from './core/config.js';
import { ApiService } from './core/api.js';
import { UIUtils } from './core/ui.js';
import { Utils } from './core/utils.js';
import { VentasManager } from './sections/ventas.js';
import { RegistrosManager } from './sections/registros.js';
import { ReferenciasManager } from './sections/referencias.js';;
import { LiquidacionesManager } from './sections/liquidaciones.js';

// Clase principal de la aplicación
class App {
  constructor() {
    this.state = {
      isOnline: true,
      currentSection: null
    };

    // Inicializar managers
    this.managers = {
      vender: new VentasManager(this),
      registros: new RegistrosManager(this),
      referencias: new ReferenciasManager(this),
      liquidaciones: new LiquidacionesManager(this)
    };

    // Inicializar servicios
    this.api = new ApiService();
    this.ui = new UIUtils();
    this.utils = Utils;
  }

  // Inicialización de la aplicación
  async init() {
    this.setupEventListeners();
    await this.checkConnection();
    this.showSection('vender'); // Mostrar sección por defecto
  }

  // Configuración de event listeners globales
  setupEventListeners() {
    // Navegación del sidebar
    document.querySelectorAll(".menu button").forEach(button => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const target = button.getAttribute("data-target");
        this.showSection(target);
      });
    });

    // Verificar conexión periódicamente
    setInterval(() => this.checkConnection(), 30000);
  }

  // Manejo de secciones
  showSection(id) {
    // Notificar al manager de la sección actual que se oculta
    if (this.state.currentSection && this.managers[this.state.currentSection]) {
      const currentManager = this.managers[this.state.currentSection];
      if (typeof currentManager.onSectionHide === 'function') {
        currentManager.onSectionHide();
      }
    }
    // Ocultar todas las secciones
    document.querySelectorAll(".section").forEach(section => {
      section.classList.remove("active");
    });

    // Mostrar sección seleccionada
    const targetSection = document.getElementById(id);
    if (targetSection) {
      targetSection.classList.add("active");
      this.state.currentSection = id;

      // Actualizar título del header
      this.updateHeaderTitle(id);

      // Inicializar sección si es necesario
      if (this.managers[id] && typeof this.managers[id].onSectionShow === 'function') {
        this.managers[id].onSectionShow();
      }
    }
  }

  // Actualizar título del header
  updateHeaderTitle(sectionId) {
    const titleElement = document.querySelector(CONFIG.ELEMENTS.sectionTitle);
    if (titleElement && SECTION_TITLES[sectionId]) {
      titleElement.textContent = SECTION_TITLES[sectionId];
    }
  }

  // Verificación de conexión
  async checkConnection() {
    try {
      const isOnline = await this.api.checkConnection();
      if (!this.state.isOnline && isOnline) {
        this.state.isOnline = true;
        this.ui.showAlert('✅ Conexión restablecida', 'success');
      }
      this.state.isOnline = isOnline;
    } catch (error) {
      if (this.state.isOnline) {
        this.state.isOnline = false;
        this.ui.showAlert('⚠️ Sin conexión a internet', 'warning');
      }
    }
    return this.state.isOnline;
  }
}

// Inicialización de la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});