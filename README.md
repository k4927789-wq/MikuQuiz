# 🎤 MikuQuiz

Quizlet multijugador  **Hatsune Miku**. Creado por **Chizu**.

## ✨ Características
-  **Iniciar partida**: creas una sala, agregas preguntas (texto + imagen/banner, 4 respuestas, 1 correcta) y configuras duración y puntos meta (máx **9000**).
-  **Unirse a partida**: los jugadores entran con el **código de sala** y un **nombre personalizable** (color + emoji).
-  Correcta = **+5 pts** ·  Incorrecta = **−4 pts** + **espera de 5 segundos**.
-  Al conseguir **15 puntos** robas **4 pts** al líder.
-  Gana quien llegue a la meta o el mejor al acabar el tiempo. Las preguntas **se repiten** en bucle.
-  El creador ve los puntajes en vivo, quién va en primer lugar y quién ganó, y controla el inicio/fin.
- � **Elige tu Vocaloid**: **Miku** (modo clásico, el creador pasa las preguntas) o **Teto** (temática roja + las preguntas **avanzan solas** cuando todos responden). Los jugadores que se unen ven el tema de la sala automáticamente. Al elegir personaje aparece una **animación de carga** que precarga todo.
-  **Respuestas revueltas**: cada jugador recibe las 4 opciones en un orden distinto, la correcta nunca está siempre en la primera.
-  **Editar preguntas**: las preguntas ya guardadas se pueden modificar o borrar desde la lista (modos Miku y Teto).
-  **Packs de preguntas**: máximo **60 preguntas por pack**. Crea un pack con nombre, guárdalo, **cárgalo para jugar**, **descárgalo** como archivo `.json` e **impórtalo** de vuelta desde " Agregar pack".
-  **Cámara del creador**: el creador ve en vivo la **pantalla real** de cada jugador ( el jugador comparte su pantalla y se ve el ratón, si sube, si abre otra ventana — trampas imposibles; en celular se ve solo lo que selecciona). Vista en tarjetas + **🔍 vista grande**. Desde ahí puede **🚫 bloquear con motivo personalizado** (el jugador ve "(creador) te bloqueó por (motivo)") y **➕ dar / ➖ quitar puntos**.
-  **Puntajes privados**: solo el creador ve los puntos de todos; cada jugador solo ve los suyos.

## 🚀 Cómo usarlo (GitHub Pages)
1. Sube esta carpeta a un repositorio de GitHub.
2. En **Settings → Pages** selecciona la rama `main` y la carpeta raíz.
3. Abre la URL que te dé GitHub. ¡Listo!

## 🕹️ Cómo jugar
1. El creador entra, pone su nombre, crea la sala y comparte el **código**.
2. Agrega preguntas y pulsa **🎮 START**.
3. Los jugadores entran con el código + su nombre personalizado.

> ⚠️ El multijugador funciona por **WebRTC (PeerJS)**. Todos deben tener conexión a internet. Si un navegador tiene bloqueadores estrictos, puede pedir permisos.

## 📁 Estructura
```
MikuQuiz/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── net.js      (conexión P2P con PeerJS)
│   ├── host.js     (vista del creador)
│   ├── player.js   (vista del jugador)
│   └── main.js     (inicio y navegación)
└── assets/
```

---
🎵 MikuQuiz · Creado por **Chizu** 🎵
