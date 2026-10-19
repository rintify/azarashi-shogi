import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ExportEnvironment from './unity/ExportEnvironment';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && new URLSearchParams(location.search).has('unity-environment') ? (
      <ExportEnvironment />
    ) : (
      <App />
    )}
  </StrictMode>,
);
