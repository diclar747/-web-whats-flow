import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/modern.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Version 3.0.0 - PWA Removed, Optimized for Speed

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring
reportWebVitals();

