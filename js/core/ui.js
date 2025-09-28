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
}