import { CONFIG, STYLES } from './config.js';

export class UIUtils {
  constructor() {
    this.alertTimeout = null;
  }

  showLoading() {
    const loader = document.querySelector(CONFIG.ELEMENTS.loadingIndicator);
    if (loader) loader.style.display = "block";
  }

  hideLoading() {
    const loader = document.querySelector(CONFIG.ELEMENTS.loadingIndicator);
    if (loader) loader.style.display = "none";
  }

  showAlert(message, type = 'info') {
    this.hideAlert(); // Oculta alertas previas

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 4px;
    color: white;
    z-index: 1000;
    max-width: 400px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: ${STYLES.alertTypes[type] || STYLES.alertTypes.info};
    animation: alertEnter 0.3s ease-out;
  `;

    alertDiv.innerHTML = `
    <span>${message}</span>
    <button class="alert-close" style="
      background: transparent;
      border: none;
      color: white;
      font-size: 1.2em;
      cursor: pointer;
      margin-left: 15px;
    ">×</button>
  `;

    document.body.appendChild(alertDiv);

    // Animación de entrada
    const keyframes = `
    @keyframes alertEnter {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
    const style = document.createElement('style');
    style.innerHTML = keyframes;
    document.head.appendChild(style);

    // Cierre al hacer click
    alertDiv.querySelector('.alert-close').addEventListener('click', () => {
      this.hideAlert(alertDiv);
    });

    // Cierre automático
    this.alertTimeout = setTimeout(() => {
      this.hideAlert(alertDiv);
    }, CONFIG.TIMEOUTS.alertDuration);
  }

  hideAlert(alertElement = null) {
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
      this.alertTimeout = null;
    }

    if (alertElement) {
      alertElement.remove();
    } else {
      const existingAlert = document.querySelector('.alert');
      if (existingAlert) existingAlert.remove();
    }
  }

  updateHeaderTitle(sectionId) {
    const titleElement = document.querySelector(CONFIG.ELEMENTS.sectionTitle);
    if (titleElement && SECTION_TITLES[sectionId]) {
      titleElement.textContent = SECTION_TITLES[sectionId];
    }
  }

  resetForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.reset();
    const firstInput = form.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }

  // Método para renderizar tablas genéricas
  renderTable(tableId, data, columns) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return;

    tableBody.innerHTML = '';
    data.forEach(item => {
      const row = document.createElement('tr');
      columns.forEach(col => {
        const cell = document.createElement('td');
        cell.textContent = col.formatter ? col.formatter(item[col.key]) : item[col.key] || '-';
        row.appendChild(cell);
      });
      tableBody.appendChild(row);
    });
  }

  /**
   * Modal de Confirmación Genérico
   * @param {Object} config { title, message, confirmText, cancelText, type }
   * @returns {Promise<boolean>}
   */
 async showConfirm({ title = 'Confirmar', message = '¿Estás seguro?', confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'primary' }) {
    return new Promise((resolve) => {
      const existing = document.getElementById('modal-global-confirm');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'modal-global-confirm';
      modal.className = 'modal-confirmacion';
      modal.style.display = 'flex';

      // Definir color del botón según el tipo
      const btnClass = type === 'danger' ? 'background-color: #dc3545;' : 'background-color: #007bff;';

      modal.innerHTML = `
        <div class="modal-confirmacion-contenido" style="max-width: 90%; width: 450px;">
          <div class="modal-confirmacion-header" style="padding: 15px; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0;">${title}</h3>
          </div>
          <div class="modal-confirmacion-body" style="padding: 20px; min-height: 80px;">
            <p style="margin: 0; color: #444; line-height: 1.5;">${message}</p>
          </div>
          <div class="modal-confirmacion-footer" style="
            padding: 15px; 
            display: flex; 
            justify-content: flex-end; 
            gap: 10px; 
            border-top: 1px solid #eee;
            flex-wrap: wrap; 
          ">
            <button id="modal-btn-cancel" class="btn" style="
              padding: 10px 20px; 
              cursor: pointer; 
              background: #6c757d; 
              color: white; 
              border: none; 
              border-radius: 4px;
              min-width: 100px;
            ">${cancelText}</button>
            
            <button id="modal-btn-confirm" class="btn" style="
              padding: 10px 20px; 
              cursor: pointer; 
              ${btnClass} 
              color: white; 
              border: none; 
              border-radius: 4px;
              min-width: 120px;
              white-space: nowrap;
            ">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const close = (result) => {
        modal.remove();
        resolve(result);
      };

      document.getElementById('modal-btn-cancel').onclick = () => close(false);
      document.getElementById('modal-btn-confirm').onclick = () => close(true);
      modal.onclick = (e) => { if (e.target === modal) close(false); };
    });
}

  /**
   * Modal de Edición Dinámico
   * @param {String} title Título del modal
   * @param {String} htmlBody Contenido HTML del formulario
   * @param {Function} onSave Callback al presionar guardar
   */
  showCustomModal(title, htmlBody, onSave) {
    const existing = document.getElementById('modal-custom-form');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-custom-form';
    modal.className = 'modal-confirmacion';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="modal-confirmacion-contenido" style="min-width: 500px;">
        <div class="modal-confirmacion-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-confirmacion-body">
          ${htmlBody}
        </div>
        <div class="modal-confirmacion-footer">
          <button id="modal-custom-cancel" class="btn btn-terciario">Cerrar</button>
          <button id="modal-custom-save" class="btn btn-primario">Guardar Cambios</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-custom-cancel').onclick = () => modal.remove();
    document.getElementById('modal-custom-save').onclick = () => {
      const formData = onSave(modal); // Pasamos el modal para que el manager extraiga los datos
      if (formData) modal.remove();
    };
  }
}