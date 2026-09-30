import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // The single source of routing
import App from './App';

// Styling imports (ensure these exist in your project)
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import './index.css';

// Auto-purge legacy database state from browser localStorage (MySQL backend & memory cache are used exclusively)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('doc_dental_db');
    localStorage.removeItem('clinic_pricelist');
  } catch (e) {}
}

// Suppress third-party cross-origin script errors and extension noise in development
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' || event.message === 'Script error') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      typeof event.reason.message === 'string' &&
      (event.reason.message.includes('A listener indicated an asynchronous response') ||
       event.reason.message.includes('Script error'))
    ) {
      event.preventDefault();
    }
  });
}


const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


