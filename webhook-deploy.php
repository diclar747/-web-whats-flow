<?php
/**
 * Webhook para auto-despliegue desde GitHub
 * Coloca este archivo en tu servidor web accesible
 */

// Token secreto para validar requests (cámbialo por uno seguro)
define('WEBHOOK_SECRET', 'tu_token_secreto_aqui_' . md5(uniqid()));

// Directorio del proyecto
define('PROJECT_DIR', '/var/www/web.whats-flow.com');

// Log file
define('LOG_FILE', PROJECT_DIR . '/logs/deploy.log');

// Función para escribir logs
function writeLog($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[{$timestamp}] {$message}\n";
    file_put_contents(LOG_FILE, $logMessage, FILE_APPEND);
    echo $logMessage;
}

// Validar signature de GitHub
function validateGitHubSignature() {
    if (!isset($_SERVER['HTTP_X_HUB_SIGNATURE_256'])) {
        return false;
    }
    
    $payload = file_get_contents('php://input');
    $signature = 'sha256=' . hash_hmac('sha256', $payload, WEBHOOK_SECRET);
    
    return hash_equals($signature, $_SERVER['HTTP_X_HUB_SIGNATURE_256']);
}

// Validar request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die('Method not allowed');
}

// Validar signature (opcional, descomenta para usar)
// if (!validateGitHubSignature()) {
//     http_response_code(403);
//     writeLog('ERROR: Invalid signature');
//     die('Forbidden');
// }

writeLog('========== NUEVO DESPLIEGUE INICIADO ==========');

// Cambiar al directorio del proyecto
chdir(PROJECT_DIR);

// Array de comandos a ejecutar
$commands = [
    'git fetch origin main',
    'git reset --hard origin/main',
    'git pull origin main',
    'npm install --production',
    'npm run build 2>&1',
    'pm2 restart all 2>&1 || echo "PM2 not restarting"'
];

// Ejecutar comandos
foreach ($commands as $command) {
    writeLog("Ejecutando: {$command}");
    $output = [];
    $returnVar = 0;
    exec($command . ' 2>&1', $output, $returnVar);
    
    $outputStr = implode("\n", $output);
    writeLog("Output: {$outputStr}");
    
    if ($returnVar !== 0) {
        writeLog("ERROR: Comando falló con código {$returnVar}");
    }
}

writeLog('========== DESPLIEGUE COMPLETADO ==========');

http_response_code(200);
echo json_encode([
    'status' => 'success',
    'message' => 'Deploy completed',
    'timestamp' => date('Y-m-d H:i:s')
]);
