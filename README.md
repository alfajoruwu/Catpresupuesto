# Catpresupuesto

App de finanzas personales para Android, con Tauri 2. Importes enteros en pesos chilenos.

## Requisitos

- Node 20+
- Rust estable
- Para Android: Android Studio con SDK y NDK, las variables `ANDROID_HOME` y `NDK_HOME`, y
  `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.

## Pasos

1. `npm install`
2. `npm run setup:ocr`: descarga los modelos PaddleOCR PP-OCRv5 móvil (detección y
   reconocimiento en ONNX, unos 21 MB, más el diccionario de caracteres v5) a `public/models`
   y copia el runtime WASM de onnxruntime a `public/ort`; es obligatorio antes de dev o build.
3. `npm run tauri dev` para escritorio.
4. `npm run tauri android init` una sola vez.
5. `npm run tauri android dev`
6. `npm run tauri android build -- --apk`

Nota: tras init, añade el permiso `android.permission.CAMERA` en
`src-tauri/gen/android/app/src/main/AndroidManifest.xml` para poder hacer fotos desde el selector.

## Estructura de carpetas

- `src/api/`: tipos y cliente tipado de los comandos Tauri.
- `src/auth/`: pantalla de inicio de sesión y creación de usuario.
- `src/lib/`: utilidades (formato, fechas, router por hash, consultas, sesión).
- `src/ocr/`: módulo local de lectura de boletas (PaddleOCR + zxing + reglas de texto).
- `src/onboarding/`: recorrido inicial.
- `src/screens/`: pantallas (home, ingresos, gastos, presupuesto, cuentas).
- `src/shell/`: estructura principal y barra inferior.
- `src/styles/`: tokens de diseño y base.
- `src/ui/`: componentes de interfaz.
- `src-tauri/`: backend Rust con contabilidad de partida doble.
- `scripts/setup-ocr-assets.mjs`: descarga de modelos OCR y runtime WASM.

## Modelo contable

- Las categorías son cuentas de ingreso o gasto.
- Las cuentas son activos.
- 'Patrimonio inicial' recoge los saldos iniciales y los ajustes.
- Cada movimiento es un asiento cuadrado.
- Los recurrentes se registran solos al llegar su fecha.
