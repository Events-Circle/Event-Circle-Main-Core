import React from 'react';
import { createRoot } from 'react-dom/client';
import { tokens } from '@events-circle/design-system';
function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui',
        maxWidth: 720,
        margin: '80px auto',
        padding: 24,
        color: tokens.colors.ink,
      }}
    >
      <p>EVENTS CIRCLE / ADMIN</p>
      <h1>Operations workspace</h1>
      <p>
        This application is a foundation shell. Administrative tools and staff authorization are not yet
        implemented.
      </p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
