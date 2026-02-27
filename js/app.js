// Importaciones de módulos
import { CONFIG, SECTION_TITLES } from './core/config.js';
import { ApiService } from './core/api.js';
import { UIUtils } from './core/ui.js';
import { Utils } from './core/utils.js';
import { VentasManager } from './sections/ventas.js';
import { RegistrosManager } from './sections/registros.js';
import { ReferenciasManager } from './sections/referencias.js';;
import { LiquidacionesManager } from './sections/liquidaciones.js';
import { EdicionesManager } from './sections/ediciones.js';

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
      liquidaciones: new LiquidacionesManager(this),
      ediciones: new EdicionesManager(this)
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

    // Botón de reportar fallos
    const btnReportar = document.getElementById('btn-reportar-fallos');
    if (btnReportar) {
      btnReportar.addEventListener('click', () => this.showReportModal());
    }

    // Botón Acerca de
    const btnAcerca = document.getElementById('btn-acerca-de');
    if (btnAcerca) {
      btnAcerca.addEventListener('click', () => this.showAboutModal());
    }
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

  showReportModal() {
    const modalBody = `
      <p style="text-align: center; margin-bottom: 25px;">Puedes reportar un fallo o sugerir una mejora de las siguientes maneras:</p>
      <div style="display: flex; justify-content: space-around; gap: 15px; flex-wrap: wrap;">
        <a href="https://github.com/byyeah/ventas-crud/issues/new" target="_blank" rel="noopener noreferrer" class="btn btn-primario" style="text-decoration: none; display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
          Abrir Issue en GitHub
        </a>
        <a href="mailto:by.yeah.dev@gmail.com?subject=Reporte de fallo en App Ventas" class="btn btn-secundario" style="text-decoration: none; display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg>
          Enviar Correo
        </a>
      </div>
    `;
    this.ui.showInfoModal('Reportar un Fallo', modalBody);
  }

  showAboutModal() {
    const modalBody = `
      <div style="text-align: center;">
        <h3 style="margin-bottom: 10px; color: #231155;">Ventas CRUD</h3>
        <p style="margin-bottom: 15px; color: #666;">Versión 1.0.0</p>
        <p style="margin-bottom: 20px; line-height: 1.6;">
          Sistema integral para la gestión de ventas, control de inventario y liquidaciones.
        </p>
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
          <p style="font-weight: bold; margin-bottom: 5px;">Desarrollado por:</p>
          <p style="font-size: 1.1em; color: #333;">ByYeah</p>
          <p style="font-size: 0.85em; color: #999; margin-top: 15px;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
        </div>
      </div>
    `;
    this.ui.showInfoModal('Acerca de', modalBody);
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

// Establecer fecha máxima y valor por defecto para Fecha Final
document.addEventListener('DOMContentLoaded', () => {
  const fechaFinInput = document.getElementById('fecha-fin-liqui');
  if (fechaFinInput) {
    const today = new Date().toISOString().split('T')[0];
    fechaFinInput.value = today;
    fechaFinInput.max = today;
  }
});