# Ventas CRUD - Simple Sales Management System

**Ventas CRUD** is a lightweight, responsive web application designed to help small local businesses manage their daily sales, track inventory references, and handle settlements (liquidations) efficiently.

It was built with a **zero-cost infrastructure** philosophy, leveraging the **Google Ecosystem** (Google Sheets and Google Apps Script) as a powerful, free, and reliable backend and database.

## 🎯 Use Case & Philosophy

This project was conceived for **small local shops** (e.g., clothing stores, kiosks, pop-up stalls) that need to move away from pen-and-paper tracking but aren't ready for expensive, complex ERP software.

**Why this solution?**
*   **100% Free Backend:** No monthly server costs or database subscriptions. It uses your Google Drive.
*   **Data Ownership:** All your data lives in a Google Sheet that you own and can access directly.
*   **Mobile Ready:** The responsive design allows shop owners to register sales from a smartphone, tablet, or desktop.
*   **Offline Resilience:** Includes basic local storage mechanisms to handle intermittent connectivity.

## ✨ Key Features

### 1. 🛒 Point of Sale (Vender)
*   Quick interface to register new sales.
*   Auto-calculation of final prices.
*   Dropdowns for standard products (Caps, Shorts, Jackets, etc.).

### 2. 📦 Reference Management (Referencias)
*   CRUD (Create, Read, Update, Delete) system for product references.
*   Define buy/sell prices and notes for specific items.
*   Acts as a catalog to speed up the sales process.

### 3. 📊 Records & History (Registros)
*   View historical sales data.
*   **Advanced Filtering:** Filter by date range, product type, or settlement status.
*   **Export:** Download reports as CSV files for external analysis.
*   **Visuals:** Quick summary chips showing total items and total revenue.

### 4. 💰 Settlements (Liquidaciones)
*   A dedicated module to manage cash flow closure.
*   Filter pending sales by date and mark them as "Liquidated" (Settled/Paid).
*   Prevents double-counting revenue.

### 5. ✏️ Editions
*   Correct mistakes in previous sales records.
*   Delete erroneous entries.
*   Secure interface to ensure data integrity.

## 🛠️ Technical Architecture

The application follows a serverless architecture using Google services:

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules). No heavy frameworks required.
*   **Backend (API):** Google Apps Script (GAS) deployed as a Web App.
*   **Database:** Google Sheets.

### How it works:
1.  The **Frontend** sends JSON requests via `fetch` to the Google Apps Script URL.
2.  **Google Apps Script** receives the request (`doPost` / `doGet`), processes the logic, and interacts with the Spreadsheet.
3.  **Google Sheets** stores the data in rows (acting as a relational DB).
4.  The response is sent back to the frontend to update the UI.

## 🚀 Setup Overview

To deploy this for your own business:

1.  **Google Sheet:** Create a new Sheet with tabs for `Ventas`, `Referencias`, etc.
2.  **Apps Script:** Open Extensions > Apps Script in the Sheet. Paste the backend logic (handling CRUD operations) and deploy as a Web App (Execute as: *Me*, Access: *Anyone*).
3.  **Configuration:** Update `js/core/config.js` in this project with your unique **GAS Web App URL**.
4.  **Host:** You can host these frontend files on GitHub Pages, Netlify, or any static hosting service for free.

## 📄 License

This project is open-source and available for personal and commercial use.

---
*Built with ❤️ for small entrepreneurs.*
