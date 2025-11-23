package com.whatsflow.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.util.List;

public class WhatsAppAccessibilityService extends AccessibilityService {

    private static final String TAG = "WhatsFlowAccess";
    private static final String WHATSAPP_PACKAGE = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";
    
    // Estados del flujo de automatización
    private enum State {
        IDLE,
        OPENING_STATUS_TAB,
        CLICKING_ADD_STATUS,
        ENTERING_TEXT,
        SENDING,
        COMPLETED
    }

    private State currentState = State.IDLE;
    private String pendingText = null;
    private Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        Log.d(TAG, "Servicio de Accesibilidad Conectado");
        Toast.makeText(this, "WhatsFlow Automatización Activa", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (currentState == State.IDLE) return;

        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";
        if (!packageName.equals(WHATSAPP_PACKAGE) && !packageName.equals(WHATSAPP_BUSINESS_PACKAGE)) {
            return;
        }

        Log.d(TAG, "Evento recibido: " + event.toString());
        processState();
    }

    // Método público para iniciar la publicación desde la MainActivity o BroadcastReceiver
    public void publishStatus(String text) {
        Log.d(TAG, "Iniciando publicación de estado: " + text);
        this.pendingText = text;
        this.currentState = State.OPENING_STATUS_TAB;
        
        // Intentar abrir WhatsApp en la pestaña de Estados
        // Nota: Esto requiere un Intent desde MainActivity, aquí solo preparamos el estado
        processState();
    }

    private void processState() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        switch (currentState) {
            case OPENING_STATUS_TAB:
                // Buscar pestaña "Estados" o "Novedades" (Updates en nuevas versiones)
                if (clickNodeByText(rootNode, "Estados") || clickNodeByText(rootNode, "Novedades") || clickNodeByText(rootNode, "Updates")) {
                    Log.d(TAG, "Pestaña de estados encontrada y clickeada");
                    currentState = State.CLICKING_ADD_STATUS;
                }
                break;

            case CLICKING_ADD_STATUS:
                // Buscar botón de "Mi estado" o el FAB de cámara/lápiz
                // Estrategia 1: Buscar "Mi estado"
                if (clickNodeByText(rootNode, "Mi estado") || clickNodeByText(rootNode, "My Status")) {
                     currentState = State.ENTERING_TEXT; // Asumiendo que abre cámara, habría que cambiar a texto
                     // Esta lógica es compleja porque depende de si abre cámara o texto directo
                } 
                // Estrategia 2: Buscar botones específicos por ID (requiere ingeniería inversa de IDs actuales)
                // Por ahora usamos texto que es más estable
                break;

            case ENTERING_TEXT:
                // Buscar campo de texto editable
                List<AccessibilityNodeInfo> editTexts = findNodesByClass(rootNode, "android.widget.EditText");
                if (!editTexts.isEmpty()) {
                    AccessibilityNodeInfo editText = editTexts.get(0);
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, pendingText);
                    editText.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    Log.d(TAG, "Texto ingresado");
                    currentState = State.SENDING;
                }
                break;

            case SENDING:
                // Buscar botón de enviar (generalmente un ImageButton con descripción "Enviar")
                if (clickNodeByContentDescription(rootNode, "Enviar") || clickNodeByContentDescription(rootNode, "Send")) {
                    Log.d(TAG, "Botón enviar clickeado");
                    currentState = State.COMPLETED;
                    pendingText = null;
                    // Notificar éxito
                }
                break;
        }
        
        rootNode.recycle();
    }

    private boolean clickNodeByText(AccessibilityNodeInfo root, String text) {
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        for (AccessibilityNodeInfo node : nodes) {
            if (node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                return true;
            }
            // Intentar clickear el padre si el nodo texto no es clickeable
            AccessibilityNodeInfo parent = node.getParent();
            if (parent != null && parent.isClickable()) {
                parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                return true;
            }
        }
        return false;
    }

    private boolean clickNodeByContentDescription(AccessibilityNodeInfo root, String description) {
        // Búsqueda manual recursiva ya que findAccessibilityNodeInfosByText no busca en contentDescription perfectamente
        return searchAndClickContentDescription(root, description);
    }

    private boolean searchAndClickContentDescription(AccessibilityNodeInfo node, String description) {
        if (node == null) return false;
        
        if (node.getContentDescription() != null && 
            node.getContentDescription().toString().equalsIgnoreCase(description)) {
            if (node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                return true;
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            if (searchAndClickContentDescription(node.getChild(i), description)) {
                return true;
            }
        }
        return false;
    }

    private List<AccessibilityNodeInfo> findNodesByClass(AccessibilityNodeInfo root, String className) {
        // Implementación simplificada, idealmente usar recursión o findAccessibilityNodeInfosByViewId si se conocen IDs
        return root.findAccessibilityNodeInfosByText(""); // Placeholder
    }

    @Override
    public void onInterrupt() {
        Log.e(TAG, "Servicio interrumpido");
    }
}
