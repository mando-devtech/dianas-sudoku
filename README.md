# 🎮 Diana's Sudoku

Juego de Sudoku estilo 8-bit / pixel art optimizado para iPhone (web app / PWA).

- **Producción:** https://dianas-sudoku.netlify.app/
- **Repositorio:** https://github.com/mando-devtech/dianas-sudoku
- **Cuenta GitHub:** `mando-devtech` (`gonzalez.dev.tech@gmail.com`)

---

## 🚀 Flujo de trabajo y versiones

La versión vive en `package.json` y se replica automáticamente a:
- `public/version.js` → se muestra en el menú principal (`VERSIÓN X.Y.Z`) y en la pantalla de pausa.
- `public/sw.js` → nombre de la caché del Service Worker (`dianas-sudoku-vX.Y.Z`), lo que invalida la copia sin conexión en el iPhone en cada release.

### 1. Desarrollo local
```bash
# Servidor local (mismo directorio public/ que publica Netlify)
npm run serve
# o bien: python server.py
```
Abre http://localhost:5000 en la PC o `http://<ip-local>:5000` en el celular.

### 2. Crear una nueva versión
Crea el commit con el cambio, sincroniza la versión y genera el tag en un solo paso:

```bash
# Bugfix (1.1.0 -> 1.1.1)
npm run release:patch

# Nueva funcionalidad (1.1.0 -> 1.2.0)
npm run release:minor

# Cambio mayor (1.1.0 -> 2.0.0)
npm run release:major
```

### 3. Publicar con Netlify CLI

#### Primera vez (vincular el sitio existente):
```bash
# Inicia sesión en el navegador con tu cuenta de Netlify
npx netlify login

# Vincula este repo al proyecto dianas-sudoku que ya creaste en Netlify
npx netlify link --name dianas-sudoku
```

#### Para probar antes de publicar:
```bash
npm run deploy:preview
# Te da una URL temporal (ej. https://deploy-preview-123--dianas-sudoku.netlify.app)
```

#### Para publicar a producción:
```bash
npm run deploy:prod
```
El script verifica que:
- El working tree esté limpio (sin cambios sin commit).
- El commit actual tenga el tag `vX.Y.Z` correspondiente.
- `version.js` y `sw.js` coincidan con `package.json`.

Al terminar:
```bash
git push origin main --follow-tags
```

---

## 📁 Estructura del repositorio

```
dianas-sudoku/
├── public/                 ← TODO lo que publica Netlify (archivos estáticos)
│   ├── index.html          ← Estructura del juego y modales
│   ├── game.js             ← Lógica, generador cliente, sonidos web audio
│   ├── style.css           ← Estilos 8-bit, modo oscuro/claro, safe areas iOS
│   ├── version.js          ← Versión actual visible en UI (autogenerado)
│   ├── sw.js               ← Service Worker con caché por versión
│   ├── manifest.json       ← Declaración PWA para "Agregar a inicio"
│   └── apple-touch-icon.png← Ícono para el iPhone
├── scripts/
│   ├── sync-version.mjs    ← Sincroniza package.json con version.js y sw.js
│   ├── check-release.mjs   ← Verificaciones antes de publicar a prod
│   └── deploy.mjs          ← Deploy con mensaje "vX.Y.Z (sha)" en Netlify
├── netlify.toml            ← publish="public" y no-cache en app shell
├── server.py               ← Servidor Python para pruebas locales/LAN
└── package.json            ← Fuente de la verdad de la versión y scripts
```

---

## 🛠 Historial de versiones

### v1.3.0 (2026-11-07)
- 🧘 **Modo Zen:** selector de modo en el menú principal (`❤️ Clásico` con 3 vidas vs `🧘 Modo Zen` sin vidas ni Game Over, pura serenidad para Diana).
- 🏷️ **Indicador Zen en juego:** badge visual en la barra superior y registro especial en la tabla de récords con etiqueta `(ZEN)`.

### v1.2.0 (2026-11-07)
- 🎨 **Rediseño Zen Moderno y Minimalista:** tipografías Plus Jakarta Sans y Outfit reemplazando el 8-bit retro.
- 🎛️ **Selector de dificultad integrado:** control segmentado con chips en el menú principal (`🌱 Fácil`, `⚡ Medio`, `🔥 Difícil`).
- 🔢 **Teclado con contadores restantes en vivo:** dígitos 1–9 con conteo en tiempo real y marca `✓` al completar los 9.
- 🔦 **Modo Spotlight y botón Borrar dedicado:** iluminación de números coincidentes y botón de borrado ergonómico.
- 🎵 **Paisaje sonoro suave:** ondas sinusoidales y triangulares cálidas y relajantes.

### v1.1.0 (2026-11-07)
- 🏷️ **Versión visible en la UI:** badge en el menú principal y leyenda en el menú de pausa.
- 💾 **Autoguardado continuo:** cada jugada, pista y deshacer se guardan al instante. Si iOS cierra la web app, Diana recupera la partida exactamente donde estaba con "CONTINUAR PARTIDA".
- ⏸️ **Pausa automática al cambiar de app:** al bloquear el iPhone o pasar a otra app, el reloj se detiene y la partida se guarda (`visibilitychange`).
- 🏆 **Victoria y Game Over atómicos:** `checkVictory` y `registerError` marcan la partida como inactiva de inmediato; se eliminó el bug que guardaba múltiples puntajes duplicados.
- 📊 **Columna de PUNTOS en la tabla de récords:** ahora se muestran Dificultad, Tiempo, Errores y Puntos (con alineación y sin desbordamiento horizontal).
- 🔄 **Caché ligada a la versión:** `sw.js` rota el nombre de la caché en cada release (`dianas-sudoku-v1.1.0`).
- 🚀 **Automatización de releases y Netlify CLI:** scripts `release:*`, `deploy:prod`, `netlify.toml` con cabeceras `no-cache` en el app shell.
