import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import {I18nProvider} from './i18n.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><I18nProvider><ErrorBoundary><App /></ErrorBoundary></I18nProvider></React.StrictMode>
);
