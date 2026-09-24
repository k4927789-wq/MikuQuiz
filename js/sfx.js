/* =========================================================
   MikuQuiz · js/sfx.js — 🔊 Efectos de sonido
   - No modifica NINGUNA lógica del juego: solo "escucha" los
     cambios que ya ocurren en pantalla (clics, aciertos,
     fallos, robos, bloqueos, timer, fin de partida, etc.)
     y reproduce sonidos sintetizados (Web Audio API), así
     que no depende de archivos de audio externos.
   - Incluye un botón flotante 🔈/🔇 para silenciar.
   ========================================================= */

const SFX = (function () {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem("mikuquiz_sfx_muted") === "1"; } catch (e) {}

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /* una nota sintetizada: freq -> frecuencia, t -> inicio (s desde ahora),
     dur -> duración, type -> forma de onda, vol -> volumen, glideTo -> desliza el tono */
  function note(freq, t, dur, type, vol, glideTo) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || "sine";
    const startAt = c.currentTime + Math.max(0, t);
    osc.frequency.setValueAtTime(freq, startAt);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), startAt + dur);
    g.gain.setValueAtTime(0.0001, startAt);
    g.gain.linearRampToValueAtTime(vol == null ? 0.22 : vol, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.connect(g); g.connect(master);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.03);
  }

  const sounds = {
    click()   { note(880, 0, 0.05, "square", 0.12); },
    toggle()  { note(600, 0, 0.05, "sine", 0.15); note(900, 0.05, 0.06, "sine", 0.12); },
    notify()  { note(700, 0, 0.06, "sine", 0.14); note(1050, 0.06, 0.08, "sine", 0.14); },
    correct() { note(880, 0, 0.09, "sine", 0.22); note(1318.5, 0.09, 0.18, "sine", 0.22); },
    wrong()   { note(260, 0, 0.22, "sawtooth", 0.2, 120); },
    tick()    { note(1300, 0, 0.035, "square", 0.07); },
    warning() { note(1046.5, 0, 0.09, "square", 0.18); note(1046.5, 0.14, 0.09, "square", 0.18); },
    steal()   { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => note(f, i * 0.055, 0.09, "triangle", 0.18)); },
    blocked() { note(196, 0, 0.16, "square", 0.22); note(164.8, 0.18, 0.2, "square", 0.22); },
    start()   { note(523.25, 0, 0.16, "sine", 0.2, 1046.5); },
    win()     { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.12, 0.24, "sine", 0.22)); },
    lose()    { [493.88, 415.3, 349.23].forEach((f, i) => note(f, i * 0.16, 0.24, "sine", 0.18)); }
  };

  function play(name) { try { sounds[name] && sounds[name](); } catch (e) {} }
  function isMuted() { return muted; }
  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem("mikuquiz_sfx_muted", muted ? "1" : "0"); } catch (e) {}
  }

  return { play, isMuted, setMuted };
})();

/* ---------- botón flotante para silenciar/activar ---------- */
(function sfxButton() {
  function build() {
    if (document.getElementById("sfx-toggle")) return;
    const b = document.createElement("button");
    b.id = "sfx-toggle";
    b.type = "button";
    b.title = "Sonido";
    b.textContent = SFX.isMuted() ? "🔇" : "🔊";
    b.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:9999;width:44px;height:44px;"
      + "border-radius:50%;border:none;cursor:pointer;font-size:20px;"
      + "background:rgba(20,20,30,.55);color:#fff;backdrop-filter:blur(4px);"
      + "box-shadow:0 4px 14px rgba(0,0,0,.35);";
    b.onclick = () => {
      SFX.setMuted(!SFX.isMuted());
      b.textContent = SFX.isMuted() ? "🔇" : "🔊";
      if (!SFX.isMuted()) SFX.play("toggle");
    };
    document.body.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded", build);
  if (document.readyState !== "loading") build();
})();

/* ---------- 1) sonido de clic en botones / opciones / tarjetas ---------- */
document.addEventListener("click", (e) => {
  const t = e.target.closest(".btn, .opt, .voca-card, .steal-target, #chat-wheel, .emoji-pick button");
  if (t && !t.disabled) SFX.play("click");
});

/* ---------- 2) observador general de la pantalla ---------- */
const _sfxSeen = new WeakSet();      // evita repetir sonido en el mismo elemento
const _sfxWarned = new WeakSet();    // aviso de tiempo bajo, una vez por partida

function _sfxClassifyToast(text) {
  if (/rob[oó]/.test(text)) return "steal";
  if (/bloque/.test(text)) return "blocked";
  if (/❌|incorrect|no se encontr/i.test(text)) return "wrong";
  if (/✅|aceptado|desbloqueado|copiado|lista/i.test(text)) return "notify";
  return "notify";
}

function _sfxScanAdded(node) {
  if (!node || node.nodeType !== 1) return;

  // toasts genéricos (steal-toast), excepto el contenedor fijo #p-steal
  if (node.classList && node.classList.contains("steal-toast") && node.id !== "p-steal") {
    SFX.play(_sfxClassifyToast(node.textContent || ""));
  }

  // jugador bloqueado
  if (node.id === "blocked-overlay") SFX.play("blocked");

  // se abrió la pestaña para elegir a quién robar
  if (node.id === "steal-panel") SFX.play("steal");

  // arranque de la partida (aparece el timer)
  const timerEl = node.id === "p-timer" || node.id === "host-timer"
    ? node
    : (node.querySelector && node.querySelector("#p-timer, #host-timer"));
  if (timerEl && !_sfxSeen.has(timerEl)) { _sfxSeen.add(timerEl); SFX.play("start"); }

  // pantalla final (trofeo)
  const trophy = node.classList && node.classList.contains("trophy") ? node : (node.querySelector && node.querySelector(".trophy"));
  if (trophy && !_sfxSeen.has(trophy)) {
    _sfxSeen.add(trophy);
    const won = /🏆/.test(trophy.textContent || "");
    SFX.play(won ? "win" : "lose");
  }

  // si trae hijos ya insertados de golpe (innerHTML), revisar dentro también
  if (node.querySelectorAll) {
    node.querySelectorAll(".steal-toast, #blocked-overlay, #steal-panel, .trophy").forEach((child) => {
      if (child !== node) _sfxScanAdded(child);
    });
  }
}

const _sfxObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === "childList") {
      m.addedNodes.forEach(_sfxScanAdded);
    } else if (m.type === "attributes" && m.attributeName === "class") {
      const el = m.target;
      // ✅ / ❌ feedback de respuesta del jugador
      if (el.id === "p-feedback") {
        if (el.classList.contains("good")) SFX.play("correct");
        else if (el.classList.contains("bad")) SFX.play("wrong");
      }
      // timer entra en rojo (queda poco tiempo)
      if ((el.id === "p-timer" || el.id === "host-timer") && el.classList.contains("low") && !_sfxWarned.has(el)) {
        _sfxWarned.add(el);
        SFX.play("warning");
      }
      // insignia de mensajes nuevos del chat
      if (el.id === "wheel-badge" && !el.classList.contains("hidden")) {
        SFX.play("notify");
      }
    } else if (m.type === "characterData") {
      // cuenta regresiva de la penalización (5,4,3,2,1)
      const p = m.target.parentElement;
      if (p && p.classList && p.classList.contains("num")) SFX.play("tick");
    }
  }
});

_sfxObserver.observe(document.body, {
  childList: true, subtree: true, attributes: true,
  attributeFilter: ["class"], characterData: true
});
