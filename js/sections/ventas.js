import { ApiService } from '../core/api.js';
import { UIUtils } from '../core/ui.js';
import { Utils } from '../core/utils.js';
import { CONFIG } from '../core/config.js';

export class VentasManager {
  constructor(app) {
    this.app = app;
    this.api = new ApiService();
    this.ui = new UIUtils();
    this.utils = Utils;
    this.ventas = [];
    this.pendingVentas = [];
    this.initElements();
    this.bindEvents();
    this.setupFormValidation();
    this.crearModalConfirmacion();
  }

  // Crear modal de confirmación personalizado
  crearModalConfirmacion() {
    // Verificar si ya existe
    if (document.getElementById('modal-confirmacion-venta')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-confirmacion-venta';
    modal.className = 'modal-confirmacion';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-confirmacion-contenido">
        <div class="modal-confirmacion-header">
          <h3>Confirmar Venta</h3>
        </div>
        <div class="modal-confirmacion-body">
          <p id="modal-texto-venta">¿Está seguro de que desea registrar esta venta?</p>
        </div>
        <div class="modal-confirmacion-footer">
          <button id="btn-modal-cancelar-venta" class="btn btn-terciario">Cancelar</button>
          <button id="btn-modal-aceptar-venta" class="btn btn-primario">Aceptar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    // Eventos para el modal
    document.getElementById('btn-modal-cancelar-venta')?.addEventListener('click', () => {
      this.cerrarModalConfirmacion();
    });
    
    document.getElementById('btn-modal-aceptar-venta')?.addEventListener('click', () => {
      this.procesarVentaReal();
      this.cerrarModalConfirmacion();
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.cerrarModalConfirmacion();
      }
    });
  }

  // Mostrar modal de confirmación
  mostrarModalConfirmacion(texto) {
    const modal = document.getElementById('modal-confirmacion-venta');
    const textoElement = document.getElementById('modal-texto-venta');
    
    if (textoElement) {
      textoElement.textContent = texto;
    }
    
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  // Cerrar modal de confirmación
  cerrarModalConfirmacion() {
    const modal = document.getElementById('modal-confirmacion-venta');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  initElements() {
    this.elements = {
      form: document.getElementById('ventaForm'),
      producto: document.getElementById('producto'),
      referencia: document.getElementById('referencia'),
      descripcion: document.getElementById('descripcion'),
      precio: document.getElementById('precio'),
      precioFinal: document.getElementById('precioFinal'),
      btnCancelar: document.getElementById('btn-cancelar'),
      tableBody: document.querySelector(CONFIG.ELEMENTS.ventasTable)
    };
  }

  bindEvents() {
    if (this.elements.form) {
      this.elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    if (this.elements.btnCancelar) {
      this.elements.btnCancelar.addEventListener('click', () => this.resetForm());
    }

    // Calcular precio final automáticamente
    if (this.elements.precio) {
      this.elements.precio.addEventListener('input', () => this.calcularPrecioFinal());
    }
  }

  setupFormValidation() {
    if (this.elements.form) {
      // Validación personalizada para precios
      this.elements.precio.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (value < 0) {
          e.target.setCustomValidity('El precio no puede ser negativo');
        } else {
          e.target.setCustomValidity('');
        }
      });

      // Validación para producto
      this.elements.producto.addEventListener('change', (e) => {
        if (!e.target.value) {
          e.target.setCustomValidity('Seleccione un producto');
        } else {
          e.target.setCustomValidity('');
        }
      });
    }
  }

  async onSectionShow() {
    if (this.ventas.length === 0) {
      await this.loadInitialData();
    }
    this.renderVentas();
    this.elements.producto?.focus();
  }

  async loadInitialData() {
    try {
      this.ui.showLoading();

      // Obtener las últimas ventas del servidor
      const response = await this.api.fetchUltimosVentas(5);
      const serverVentas = response.data; // Extraer el array de la respuesta

      // Obtener ventas pendientes locales
      this.pendingVentas = this.utils.getPendingVentas();

      // Filtrar duplicados
      this.ventas = this.mergeAndDeduplicateVentas(serverVentas, this.pendingVentas);

      // Procesar pendientes si hay conexión
      if (this.app.state.isOnline && this.pendingVentas.length > 0) {
        await this.processPendingVentas();
      }

      this.ui.hideLoading();
    } catch (error) {
      console.error('Error cargando ventas:', error);
      this.ui.showAlert('Error al cargar ventas', 'error');
      this.ui.hideLoading();

      // Usar solo ventas locales si falla la conexión
      this.ventas = this.utils.getPendingVentas();
    }
  }

  async handleFormSubmit() {
    const nuevaVenta = this.createVentaFromForm();

    // Validar campos antes de mostrar confirmación
    if (!nuevaVenta.producto || !nuevaVenta.precio) {
      this.ui.showAlert('Por favor complete los campos obligatorios', 'warning');
      return;
    }

    // Mostrar modal de confirmación
    const textoConfirmacion = `¿Confirmar venta de "${nuevaVenta.producto}" por ${this.utils.formatCurrency(nuevaVenta.precioFinal)}?`;
    this.mostrarModalConfirmacion(textoConfirmacion);
  }

  // Procesar venta real (después de aceptar en modal)
  async procesarVentaReal() {
    const nuevaVenta = this.createVentaFromForm();

    try {
      // Añadir temporalmente el nuevo registro (no reemplazar toda la lista)
      this.ventas.unshift(nuevaVenta);
      this.renderVentas(); // Mostrar inmediatamente

      const result = await this.api.sendVenta(nuevaVenta);

      if (result?.status === 'success') {
        this.ui.showAlert('✅ Venta registrada con éxito', 'success');
        this.resetForm(true);

        // Obtener los últimos 5 registros del servidor y mantener el nuevo registro si está entre los últimos 5
        const response = await this.api.fetchUltimosVentas(5);
        const nuevosUltimos = response.data;

        // Verificar si el nuevo registro está entre los últimos 5
        const nuevoRegistroEstaEnUltimos = nuevosUltimos.some(venta => 
          Array.isArray(venta) && venta[0] === nuevaVenta.id
        );

        if (nuevoRegistroEstaEnUltimos) {
          // Si está entre los últimos 5, usar los registros del servidor
          this.ventas = nuevosUltimos;
        } else {
          // Si no está entre los últimos 5, mantener los registros actuales
          // (el nuevo registro ya no es uno de los 5 más recientes)
          // Pero actualizamos solo los registros existentes para reflejar cambios
          this.ventas = this.actualizarRegistrosExistentes(this.ventas, nuevosUltimos);
        }
        
        this.renderVentas();
      } else {
        this.savePendingVenta(nuevaVenta);
        this.ui.showAlert('⚠️ Se guardó localmente', 'warning');
        this.resetForm(true); 
      }
    } catch (error) {
      this.savePendingVenta(nuevaVenta);
      this.ui.showAlert('Offline - Se guardó localmente', 'info');
      this.resetForm(true); 
    }
  }

  // Nuevo método para actualizar solo los registros existentes
  actualizarRegistrosExistentes(ventasActuales, nuevosRegistros) {
    const actualizados = [...ventasActuales];
    const nuevosMap = new Map();
    
    // Crear mapa de nuevos registros por ID
    nuevosRegistros.forEach(venta => {
      if (Array.isArray(venta) && venta[0]) {
        nuevosMap.set(venta[0], venta);
      }
    });

    // Actualizar los registros existentes que también están en los nuevos
    for (let i = 0; i < actualizados.length; i++) {
      const venta = actualizados[i];
      let id;
      
      if (Array.isArray(venta)) {
        id = venta[0];
      } else if (venta.id) {
        id = venta.id;
      }
      
      if (id && nuevosMap.has(id)) {
        actualizados[i] = nuevosMap.get(id);
      }
    }

    return actualizados;
  }

  resetForm(clearAll = true) { 
    if (!this.elements.form) return;

    this.elements.form.reset();
    this.elements.precioFinal.value = '';

    // Resetear el estado modificado del precio final
    if (this.elements.precioFinal) {
      this.elements.precioFinal.removeAttribute('data-modified');
    }

    // Enfocar el primer campo
    this.elements.producto?.focus();
  }

  createVentaFromForm() {
    const now = new Date();

    return {
      id: Date.now(),
      producto: this.elements.producto.value.trim(),
      referencia: this.elements.referencia.value.trim(),
      descripcion: this.elements.descripcion.value.trim(),
      precio: parseFloat(this.elements.precio.value) || 0,
      precioFinal: this.elements.precioFinal.value
        ? parseFloat(this.elements.precioFinal.value)
        : parseFloat(this.elements.precio.value),
      fecha: this.utils.formatDateLocal(now),
      hora: this.utils.formatTimeLocal(now),
      _timestamp: Date.now()
    };
  }

  mergeAndDeduplicateVentas(serverVentas, localVentas) {
    const uniqueVentas = [];
    const ids = new Set();

    // Primero agregar ventas del servidor
    serverVentas.forEach(venta => {
      if (!ids.has(venta[0])) { // El ID está en índice 0
        ids.add(venta[0]);
        uniqueVentas.push(venta);
      }
    });

    // Luego agregar ventas locales que no estén en el servidor
    localVentas.forEach(venta => {
      if (!ids.has(venta.id)) {
        ids.add(venta.id);
        uniqueVentas.push(venta);
      }
    });

    return uniqueVentas;
  }

  renderVentas() {
    if (!this.elements.tableBody) return;

    // Asegurarse de que las ventas estén en formato correcto
    const ventasFormateadas = this.ventas.map(venta => {
      if (Array.isArray(venta)) {
        // Si es un array (registro de servidor), convertirlo a objeto
        return {
          id: venta[0],
          producto: venta[1],
          referencia: venta[2] || '-',
          descripcion: venta[3] || '-',
          precio: venta[4],
          precioFinal: venta[5],
          fecha: this.utils.formatDisplayDate(venta[6]),
          hora: venta[7] || '--:--'
        };
      }
      // Si ya es un objeto (venta local), usarlo directamente
      return venta;
    });

    const lastFive = ventasFormateadas.slice(0, 5);
    this.elements.tableBody.innerHTML = '';

    lastFive.forEach(venta => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${venta.id}</td>
        <td>${venta.producto}</td>
        <td>${venta.referencia}</td>
        <td>${venta.descripcion}</td>
        <td>${this.utils.formatCurrency(venta.precio)}</td>
        <td>${this.utils.formatCurrency(venta.precioFinal)}</td>
        <td>${venta.fecha} / ${venta.hora}</td>
      `;
      this.elements.tableBody.appendChild(row);
    });
  }

  calcularPrecioFinal() {
    if (!this.elements.precio || !this.elements.precioFinal) return;

    const precio = parseFloat(this.elements.precio.value) || 0;

    // Solo actualizar si el precio final no ha sido modificado manualmente
    if (!this.elements.precioFinal.dataset.modified) {
      this.elements.precioFinal.value = precio.toFixed(0);
    }
  }

  async processPendingVentas() {
    if (this.pendingVentas.length === 0) return;

    const results = {
      success: [],
      failed: []
    };

    // Procesar en lotes para evitar timeouts
    for (let i = 0; i < this.pendingVentas.length; i++) {
      const venta = this.pendingVentas[i];

      try {
        const result = await this.api.sendVenta(venta);

        if (result?.status === 'success' && !result?.isDuplicate) {
          results.success.push(venta);
        } else {
          results.failed.push(venta);
        }
      } catch (error) {
        console.error('Error sincronizando venta pendiente:', error);
        results.failed.push(venta);
      }
    }

    this.utils.savePendingVentas(results.failed);
    this.pendingVentas = results.failed;

    if (results.success.length > 0) {
      this.ui.showAlert(`✅ ${results.success.length} ventas sincronizadas`, 'success');
      // Actualizar lista desde el servidor (solo últimos 5)
      const response = await this.api.fetchUltimosVentas(5);
      this.ventas = response.data; // Solo los últimos 5
      this.renderVentas();
    }
  }

  savePendingVenta(venta) {
    const pending = this.utils.getPendingVentas();

    // Verificar si ya existe una venta pendiente similar
    const exists = pending.some(p =>
      p.producto === venta.producto &&
      p.referencia === venta.referencia &&
      Math.abs(p._timestamp - venta._timestamp) < 60000 // 1 minuto de diferencia
    );

    if (!exists) {
      pending.push(venta);
      this.utils.savePendingVentas(pending);
    }
  }
}