package com.whatsflow.accessibility;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.statusText);
        Button btnEnable = findViewById(R.id.btnEnableAccessibility);
        
        btnEnable.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openAccessibilitySettings();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkAccessibilityStatus();
    }

    private void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        startActivity(intent);
    }

    private void checkAccessibilityStatus() {
        // Lógica básica para verificar si el servicio está activo
        // En una app real, se verifica Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        statusText.setText("Estado: Verificando...");
    }
}
