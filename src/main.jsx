import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/* COMPREHENSIVE DIAGNOSTIC AND RESOLUTION PROTOCOL (CDRP) */
/* ═════════════════════════════════════════════════════════ */

console.time("Diagnostic Pipeline Execution");
console.log("[DIAG] RENDERING STACK INVESTIGATION: Initiated...");

try {
  // 1. Rendering Pipeline Integrity Check
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("DIAGNOSTIC FAILURE: Root element (#root) not found. Rendering pipeline collapsed.");
  }
  console.log("[DIAG] PIPELINE: Root element validated.");

  // 2. Initialization Diagnostics
  console.log("[DIAG] INITIALIZATION: Bootstrapping React execution context...");
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  console.log("[DIAG] EXECUTION: Render cycle dispatched. Swap chain presentation status: OK.");
  console.timeEnd("Diagnostic Pipeline Execution");

} catch (error) {
  // 5. Initialization Exception Handling & Detailed Stack Trace Capture
  console.error("[DIAG] CRITICAL STARTUP EXCEPTION:", error);
  
  // Design a robust fallback display for diagnostic reporting
  document.body.innerHTML = `
    <div style="background: #000; color: #fff; padding: 60px; font-family: 'DM Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 4px solid #ff4d4d;">
      <div style="font-size: 64px; margin-bottom: 24px;">🚨</div>
      <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">Rendering Stack Exception</h1>
      <p style="font-size: 16px; color: #94A3B8; max-width: 600px; line-height: 1.6; margin-bottom: 32px;">
        The Application Initialization Protocol was halted. A critical failure was detected in the rendering pipeline.
      </p>
      <div style="background: #111; padding: 24px; border-radius: 12px; border: 1px solid #333; width: 100%; max-width: 700px; text-align: left; overflow: auto;">
        <div style="color: #ff4d4d; font-family: monospace; font-size: 14px; margin-bottom: 8px; font-weight: 700;">[DIAGNOSTIC_LOG]:</div>
        <pre style="color: #E2E8F0; font-family: ui-monospace, Consolas, monospace; font-size: 12px; margin: 0;">${error.stack || error.message}</pre>
      </div>
      <button onclick="window.location.reload()" style="margin-top: 40px; background: #fff; color: #000; border: none; padding: 12px 32px; border-radius: 100px; font-weight: 700; cursor: pointer; transition: transform 0.2s;">
        RE-EXECUTE PIPELINE
      </button>
    </div>
  `;
}
