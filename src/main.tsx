import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary scope="application">
      <App />
    </ErrorBoundary>,
  );
} else {
  const fallback = document.createElement('div');
  fallback.setAttribute('role', 'alert');
  fallback.style.padding = '24px';
  fallback.style.fontFamily = 'sans-serif';
  fallback.textContent = 'Unable to mount MedReport-Guard: missing root container.';
  document.body.appendChild(fallback);
}
