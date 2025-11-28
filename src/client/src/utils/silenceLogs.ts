// Silenciar TODOS los console.log excepto errores
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

export const initSilentLogs = () => {
  // Reemplazar console.log con función vacía
  console.log = function() {
    // NO hacer nada - silenciar TODO
  };

  console.warn = function() {
    // NO hacer nada - silenciar TODO
  };

  // Errors se mantienen igual
  console.error = originalError;
};
