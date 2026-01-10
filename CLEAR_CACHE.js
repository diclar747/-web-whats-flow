// INSTRUCCIONES PARA LIMPIAR CACHÉ DEL NAVEGADOR
// Ejecuta esto en la consola del navegador (F12 -> Console)

console.log('🧹 Limpiando caché de chats antiguos...');

// Limpiar localStorage
localStorage.removeItem('whatsapp_chats');
localStorage.removeItem('cached_chats');
localStorage.removeItem('chats_cache');

// Limpiar sessionStorage  
sessionStorage.removeItem('whatsapp_chats');
sessionStorage.removeItem('cached_chats');
sessionStorage.removeItem('chats_cache');

console.log('✅ Caché limpiado. Recarga la página con Ctrl + F5');

// Auto-recargar
setTimeout(() => {
    window.location.reload(true);
}, 1000);
