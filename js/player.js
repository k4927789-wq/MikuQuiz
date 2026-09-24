/* =========================================================
   MikuQuiz · js/player.js  (vista del JUGADOR que se une)
   - Pide código + nombre personalizable (color y emoji)
   - Espera en lobby hasta que el creador dé START
   - Responde: +5 acierto, −4 fallo + penalización 5 s
   - Ve puntajes, robos y el resultado final
   ========================================================= */

const PlayerGame = {
  client: null,
  me: { name: "", color: "#39C5BB", emoji: "🎤" },
  scores: [],
  target: 100,
  qIndex: -1,
  total: 0,
  answered: false,
  myScore: 0,
  blocked: false,
  stream: null,        // pantalla compartida (video)
  pendingCall: null,   // llamada del creador esperando aceptación
  started: false,      // ¿la partida ya empezó?
  isAdmin: false,      // 🛡️ puede chatear durante la partida
  chatLog: [],         // 💬 mensajes recibidos
  unread: 0,           // mensajes sin leer (insignia de la rueda)

  join(code) {
    const st = this;
    this.client = new Client(code, {
      onOpen() {
        document.getElementById("join-status").textContent = "🟢 Conectado · esperando al creador...";
        st.client.send({ t: "join", name: st.me.name, color: st.me.color, emoji: st.me.emoji, avatar: st.me.avatar || null });
        ensureChatWheel();
      },
      onData(m) { st.handle(m); },
      onClose() {
        const e = document.getElementById("player-view");
        if (e) e.innerHTML = `<div class="card end-box"><h1>🔌 Desconectado</h1>
          <p style="color:#bfe9e5;margin:12px 0">El creador cerró la sala o perdió conexión.</p>
          <button class="btn" onclick="goHome()">🏠 Volver al inicio</button></div>`;
      },
      onError(err) {
        const s = document.getElementById("join-status");
        if (s) { s.textContent = "❌ No se encontró la sala. Revisa el código."; s.style.color = "#ff6b6b"; }
      }
    });
  },

  handle(m) {
    switch (m.t) {
      case "lobby":
        if (m.theme) applyTheme(m.theme);
        renderPlayerLobby(m.players);
        break;
      case "start":
        if (m.theme) applyTheme(m.theme);
        this.target = m.target;
        this.started = true;
        renderPlayerGameShell();
        setTimeout(() => inviteShare(false), 600);   // invita a activar la cámara al empezar
        break;
      case "q":
        this.qIndex = m.index; this.total = m.total; this.answered = false;
        renderPlayerQuestion(m);
        this.sendView("answering", null);
        break;
      case "res": {
        this.myScore = m.score;
        renderPlayerResult(m);
        break;
      }
      case "steal":
        if (m.stealer === this.me.name || m.victim === this.me.name) closeStealPanel();
        renderStealToast(m);
        break;
      case "stealoffer":
        renderStealPanel(m);
        break;
      case "scores":
        this.scores = m.scores; this.target = m.target;
        renderPlayerScores(m.scores, m.target);
        break;
      case "tick": {
        const el = document.getElementById("p-timer");
        if (el) { el.textContent = fmtTime(m.left); el.classList.toggle("low", m.left <= 30); }
        break;
      }
      case "end":
        this.started = false;
        renderPlayerEnd(m);
        break;
      case "blocked":
        this.applyBlocked(m);
        break;
      case "chat":                       // 💬 mensaje del chat
        this.chatLog.push({ from: m.from, msg: m.msg, admin: !!m.admin });
        if (document.getElementById("chat-panel")) renderChatMessages();
        else { this.unread++; updateWheelBadge(); }
        break;
      case "chatdenied":
        toast("🔒 Solo los admins pueden chatear durante la partida");
        break;
      case "admincode":                  // 🛡️ el creador me dio un código
        showAdminCode(m.code);
        break;
      case "adminok":
        this.isAdmin = true;
        toast("🛡️ ¡Código aceptado! Chat desbloqueado 💬");
        closeAdminCode();
        { const cp = document.getElementById("chat-panel"); if (cp) cp.remove(); toggleChatPanel(); }
        break;
      case "adminbad":
        toast("Código incorrecto ❌");
        break;
      case "adminon":
        toast("🛡️ " + m.name + " ahora es admin de la sala");
        break;
      case "adminoff":
        toast(m.name + " ya no es admin");
        break;
      case "needscreen":
        toast("🔒 El creador exige pantalla compartida para responder. Pulsa 🖥️ Cámara anti-trampas");
        break;
      case "points":
        this.myScore = m.score;
        const ps = document.getElementById("p-score");
        if (ps) ps.textContent = m.score;
        toast((m.delta > 0 ? "➕ +" : "➖ −") + Math.abs(m.delta) + " pts de " + m.by + " (total " + m.score + ")");
        break;
      case "error":
        alert(m.msg);
        this.client.destroy(); goHome();
        break;
    }
  },

  answer(choice) {
    if (this.blocked || this.answered) return;
    this.answered = true;
    this.client.send({ t: "answer", qIndex: this.qIndex, choice });
  },

  /* avisa al creador lo que ve/hace este jugador (para la cámara) */
  sendView(st, picked) {
    this.client.send({ t: "view", q: this.qIndex, picked: picked == null ? null : picked, st: st });
  },

  applyBlocked(m) {
    this.blocked = m.blocked;
    let o = document.getElementById("blocked-overlay");
    if (m.blocked) {
      if (!o) {
        o = document.createElement("div");
        o.className = "blocked-overlay";
        o.id = "blocked-overlay";
        document.body.appendChild(o);
      }
      const motive = m.reason ? "te bloqueó por " + m.reason : "te ha bloqueado por inactivo";
      o.innerHTML = `<div class="blocked-icon">🚫</div>
        <div class="blocked-msg">${esc(m.by)} ${esc(motive)}</div>
        <div class="blocked-sub">Ya no puedes responder.<br>Espera a que el creador te desbloquee...</div>`;
    } else if (o) {
      o.remove();
      toast("Has sido desbloqueado ✅");
    }
  },

  destroy() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.client) { this.client.destroy(); this.client = null; }
    ["chat-wheel", "chat-panel", "admin-code-float"].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    this.started = false; this.isAdmin = false; this.chatLog = []; this.unread = 0;
  }
};

/* ---------- renders ---------- */
const EMOJIS = ["🎤","🎵","🌸","💙","🦋","⭐","🍜","🎮","🎧","🌊"];

function renderJoinForm(code) {
  app().innerHTML = `
  <div class="card" style="max-width:460px;margin:30px auto">
    <h2 class="title">🎮 Unirse a partida</h2>
    <div class="field"><label>Código de sala</label>
      <input id="join-code" placeholder="Ej: K7Q2M" value="${esc(code||"")}" style="text-transform:uppercase"></div>
    <div class="field"><label>Tu nombre</label>
      <input id="join-name" placeholder="Ej: MikuFan2007" maxlength="16"></div>
    <div class="field"><label>Tu color</label>
      <input id="join-color" type="color" value="#39C5BB" style="height:46px;padding:4px"></div>
    <div class="field"><label>Tu avatar (foto de la galería o emoji)</label>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
        <div id="avatar-preview" class="avatar-preview">🎤</div>
        <div style="flex:1">
          <button class="btn small secondary" id="btn-avatar-photo" style="width:100%">📷 Elegir foto</button>
          <button class="btn small ghost hidden" id="btn-avatar-clear" style="width:100%;margin-top:6px">✖ Quitar foto</button>
          <input type="file" id="avatar-file" accept="image/*" style="display:none">
        </div>
      </div>
      <div class="emoji-pick" id="emoji-pick">
        ${EMOJIS.map((e,i)=>`<button class="${i===0?'on':''}" data-e="${e}">${e}</button>`).join("")}
      </div></div>
    <div class="hint" style="margin-top:10px">🖥️ Esta sala es <b>anti-trampas</b>: el creador puede pedirte compartir tu pantalla para jugar (se ve solo durante la partida y lo puedes detener al salir).</div>
    <div id="join-status" class="hint" style="margin:14px 0">🟡 Escribe tus datos y entra 🎵</div>
    <button class="btn" id="btn-join" style="width:100%">🚪 Entrar y acepto la cámara anti-trampas 🖥️</button>
    <button class="btn ghost" id="btn-back" style="width:100%;margin-top:10px">← Volver</button>
  </div>`;

  let emoji = EMOJIS[0];
  let avatar = null;
  const avatarPreview = document.getElementById("avatar-preview");
  document.querySelectorAll("#emoji-pick button").forEach(b => b.onclick = () => {
    emoji = b.dataset.e;
    if (!avatar) avatarPreview.textContent = emoji;
    document.querySelectorAll("#emoji-pick button").forEach(x => x.classList.toggle("on", x === b));
  });
  document.getElementById("btn-avatar-photo").onclick = () => document.getElementById("avatar-file").click();
  document.getElementById("avatar-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      avatar = await fileToAvatar(f);
      avatarPreview.innerHTML = `<img class="avatar-preview-img" src="${avatar}">`;
      document.getElementById("btn-avatar-clear").classList.remove("hidden");
      toast("¡Foto de perfil lista! 📷");
    } catch (err) { toast("No se pudo cargar la foto ❌"); }
  };
  document.getElementById("btn-avatar-clear").onclick = () => {
    avatar = null;
    avatarPreview.textContent = emoji;
    document.getElementById("btn-avatar-clear").classList.add("hidden");
  };

  document.getElementById("btn-join").onclick = () => {
    const c = document.getElementById("join-code").value.trim().toUpperCase();
    const n = document.getElementById("join-name").value.trim();
    if (!c) return toast("Pon el código de sala 🔑");
    if (!n) return toast("Pon tu nombre ✍️");
    PlayerGame.me = { name: n, color: document.getElementById("join-color").value, emoji, avatar };
    renderPlayerWaiting();
    PlayerGame.join(c);
  };
  document.getElementById("btn-back").onclick = goHome;
}

/* ---------- 💬 RUEDA DE CHAT + 🛡️ CANJE DE ADMIN ---------- */
function ensureChatWheel() {
  if (document.getElementById("chat-wheel")) return;
  const b = document.createElement("button");
  b.id = "chat-wheel";
  b.title = "Chat de la sala";
  b.innerHTML = `🎡<span id="wheel-badge" class="hidden"></span>`;
  b.onclick = toggleChatPanel;
  document.body.appendChild(b);
}
function updateWheelBadge() {
  const b = document.getElementById("wheel-badge");
  if (!b) return;
  b.textContent = PlayerGame.unread || "";
  b.classList.toggle("hidden", !PlayerGame.unread);
}
function toggleChatPanel() {
  const ex = document.getElementById("chat-panel");
  if (ex) { ex.remove(); return; }
  PlayerGame.unread = 0; updateWheelBadge();
  const canChat = !PlayerGame.started || PlayerGame.isAdmin;
  const d = document.createElement("div");
  d.className = "modal-overlay";
  d.id = "chat-panel";
  d.innerHTML = `<div class="modal-card" style="max-width:480px;display:flex;flex-direction:column;max-height:75vh">
    <h2 class="title">💬 Chat de la sala</h2>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="row" style="margin-top:8px">
      <input id="chat-input" placeholder="Escribe un mensaje..." maxlength="140" ${canChat ? "" : "disabled"}>
      <button class="btn small" id="btn-chat-send" style="flex:0 0 auto" ${canChat ? "" : "disabled"}>➤</button>
    </div>
    <div class="hint" style="margin-top:6px">${canChat
      ? (PlayerGame.isAdmin ? "🛡️ Eres admin: puedes chatear aunque la partida esté en curso"
                            : "Chat libre para todos mientras esperan al creador")
      : "🔒 El chat de partida es solo para admins — pon tu código 🛡️ abajo para desbloquearlo"}</div>
    <div id="admin-redeem" class="${PlayerGame.isAdmin ? "hidden" : ""}" style="margin-top:10px">
      <label style="margin:0 0 4px">🛡️ Pon tu código de admin</label>
      <div class="hint" style="margin:0 0 6px">El creador decide quién es admin — si no tienes código, pídeselo 🔑</div>
      <div class="row">
        <input id="admin-code" placeholder="Pega tu código aquí" style="text-transform:uppercase">
        <button class="btn small secondary" id="btn-redeem" style="flex:0 0 auto">Desbloquear</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(d);
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector("#btn-chat-send").onclick = () => {
    const inp = d.querySelector("#chat-input");
    const t = inp.value.trim();
    if (!t) return;
    PlayerGame.client.send({ t: "chat", msg: t });
    inp.value = "";
  };
  d.querySelector("#chat-input").onkeydown = e => {
    if (e.key === "Enter") d.querySelector("#btn-chat-send").click();
  };
  d.querySelector("#btn-redeem").onclick = () => {
    const c = d.querySelector("#admin-code").value.trim().toUpperCase();
    if (c) PlayerGame.client.send({ t: "redeem", code: c });
  };
  renderChatMessages();
}
function renderChatMessages() {
  const box = document.getElementById("chat-messages");
  if (!box) return;
  box.innerHTML = PlayerGame.chatLog.map(e => `<div class="chat-msg">
    <span class="dot" style="background:${e.from.color}"></span>${e.from.avatar
      ? `<img class="avatar" style="width:20px;height:20px" src="${esc(e.from.avatar)}">`
      : `<span>${esc(e.from.emoji)}</span>`}
    <b style="color:${e.from.color}">${esc(e.from.name)}${e.admin ? " 🛡️" : ""}:</b>
    <span>${esc(e.msg)}</span></div>`).join("")
    || `<div class="hint">Aún no hay mensajes — saluda 👋</div>`;
  box.scrollTop = box.scrollHeight;
}
/* 🛡️ ventanita flotante con el código de admin (estilo bloqueo) */
function showAdminCode(code) {
  closeAdminCode();
  const d = document.createElement("div");
  d.className = "admin-code-float";
  d.id = "admin-code-float";
  d.innerHTML = `
    <button class="acf-close" id="acf-close" title="Cerrar">✖</button>
    <div class="acf-title">🛡️ ¡El creador te dio ADMIN!</div>
    <div class="acf-label">TU CÓDIGO:</div>
    <div class="acf-code">${esc(code)}</div>
    <button class="btn small" id="acf-copy" style="width:100%">📋 Copiar código</button>
    <div class="acf-hint">Ábrelo en la rueda 🎡 y pégalo ahí para desbloquear el chat público</div>`;
  document.body.appendChild(d);
  d.querySelector("#acf-close").onclick = closeAdminCode;
  d.querySelector("#acf-copy").onclick = () => {
    navigator.clipboard?.writeText(code);
    toast("Código copiado 📋");
  };
}
function closeAdminCode() { const el = document.getElementById("admin-code-float"); if (el) el.remove(); }

/* foto de la galería -> dataURL redimensionado (128px) para el avatar */
function fileToAvatar(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const ctx = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = rej;
      img.src = r.result;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function renderPlayerWaiting() {
  app().innerHTML = `
  <div id="player-view"><div class="card" style="max-width:560px;margin:40px auto;text-align:center">
    <h2 class="title">🎧 ${PlayerGame.me.avatar
      ? `<img class="avatar" src="${PlayerGame.me.avatar}">`
      : esc(PlayerGame.me.emoji)} ${esc(PlayerGame.me.name)}</h2>
    <div id="join-status" style="margin:10px 0;color:#bfe9e5">🟡 Conectando...</div>
    <h2 class="title" style="margin-top:20px">👥 En la sala</h2>
    <div class="players" id="p-lobby"></div>
    <p class="hint" style="margin-top:16px">El creador inicia la partida cuando quiera... 🎵</p>
    <p class="hint" style="margin-top:6px">💬 Mientras tanto, chatea con todos desde la rueda 🎡 (abajo a la derecha)</p>
  </div></div>`;
}

function renderPlayerLobby(players) {
  const box = document.getElementById("p-lobby");
  if (!box) return;
  box.innerHTML = players.map(p => `
    <div class="player-chip"><span class="dot" style="background:${p.color}"></span>
      ${avatarHtml(p)}<b>${esc(p.name)}</b></div>`).join("");
}

function renderPlayerGameShell() {
  document.getElementById("player-view").innerHTML = `
  <div class="card">
    <div class="game-top">
      <div class="my-score">⭐ <span id="p-score">0</span> pts</div>
      <div class="timer" id="p-timer">--:--</div>
      <div class="hint" id="p-qnum"></div>
      <button class="btn small ghost" id="btn-share">🖥️ Cámara anti-trampas (compartir pantalla)</button>
    </div>
    <div class="steal-toast hidden" id="p-steal"></div>
    <div id="p-q"></div>
    <h2 class="title" style="margin-top:20px">📊 Mi puntaje</h2>
    <div class="scoreboard" id="p-scores"></div>
  </div>`;
}

document.addEventListener("click", e => {
  if (e.target && e.target.id === "btn-share") PlayerGame.startShare();
});

/* pantalla de invitación para compartir (el clic es el gesto que pide el permiso) */
function inviteShare(urgent) {
  if (PlayerGame.stream || document.getElementById("share-invite")) return;
  const d = document.createElement("div");
  d.className = "penalty";
  d.id = "share-invite";
  d.innerHTML = `<div style="font-size:70px">🖥️</div>
    <div style="font-size:24px;font-weight:800;text-align:center;max-width:440px">Cámara anti-trampas</div>
    <div style="color:#bfe9e5;text-align:center;max-width:430px;line-height:1.5">${urgent
      ? "El creador quiere ver tu pantalla <b>ahora</b>. Actívala para seguir jugando."
      : "En esta sala el creador puede ver tu pantalla durante la partida para evitar trampas. Solo se ve lo que hagas en el juego 🎮"}</div>
    <button class="btn" id="btn-share-now" style="min-width:260px">🖥️ Activar cámara</button>
    <button class="btn ghost" id="btn-share-later">Ahora no</button>`;
  document.body.appendChild(d);
  d.querySelector("#btn-share-now").onclick = async () => {
    d.remove();
    await PlayerGame.startShare();
  };
  d.querySelector("#btn-share-later").onclick = () => d.remove();
}

function renderPlayerQuestion(m) {
  const q = m.q;
  const el = document.getElementById("p-q");
  if (!el) return;
  document.getElementById("p-qnum").textContent = `Pregunta ${m.index+1}/${m.total}`;
  document.getElementById("p-steal").classList.add("hidden");
  el.innerHTML = `
    <div class="q-card">
      <img class="q-img" src="${esc(q.img)}" onerror="this.src='${themeIcon()}'">
      <div class="q-text">${esc(q.text)}</div>
      ${q.answers.map((a,i)=>`<button class="opt" data-i="${i}">${esc(a)}</button>`).join("")}
      <div class="feedback" id="p-feedback"></div>
    </div>`;
  el.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    el.querySelectorAll(".opt").forEach(x => x.disabled = true);
    b.classList.add("wrong");
    PlayerGame.answer(+b.dataset.i);
    PlayerGame.sendView("picked", +b.dataset.i);
  });
}

function renderPlayerResult(m) {
  const fb = document.getElementById("p-feedback");
  const el = document.getElementById("p-q");
  if (!fb || !el) return;
  document.getElementById("p-score").textContent = m.score;

  el.querySelectorAll(".opt").forEach((b,i) => {
    b.disabled = true;
    if (i === m.correct) b.classList.add("right");
  });

  if (m.ok) {
    fb.className = "feedback good";
    fb.textContent = `✅ ¡Correcto! +5 pts (total ${m.score})`;
    PlayerGame.sendView("ok", null);
  } else {
    fb.className = "feedback bad";
    fb.textContent = `❌ Incorrecto · −4 pts (total ${m.score})`;
    PlayerGame.sendView("penalty", null);
    // penalización: esperar 5 segundos antes de poder seguir
    showPenalty();
    setTimeout(() => PlayerGame.sendView("wait", null), 5000);
  }
}

function showPenalty() {
  const d = document.createElement("div");
  d.className = "penalty";
  d.innerHTML = `<div style="font-size:22px;font-weight:800">⏳ ¡Incorrecto! Espera 5 segundos...</div>
    <div class="num">5</div><div style="color:#bfe9e5">Prepárate para la siguiente pregunta 🎵</div>`;
  document.body.appendChild(d);
  let n = 5;
  const iv = setInterval(() => {
    n--;
    const num = d.querySelector(".num");
    if (num) num.textContent = n;
    if (n <= 0) { clearInterval(iv); d.remove(); }
  }, 1000);
}

/* 🔥 pestaña para elegir a quién robar (se abre al llegar a 15 pts) */
function renderStealPanel(m) {
  closeStealPanel();
  const d = document.createElement("div");
  d.className = "modal-overlay";
  d.id = "steal-panel";
  d.innerHTML = `<div class="modal-card" style="max-width:460px;text-align:center">
    <h2 class="title">🔥 ¡Llegaste a 15 puntos!</h2>
    <div style="color:#bfe9e5;margin-bottom:14px">Elige a quién le robas <b style="color:var(--gold)">${m.amount} pts</b>:</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${m.players.map(pl => `<button class="steal-target" data-n="${esc(pl.name)}">
        <span class="steal-dot" style="background:${pl.color}"></span><span>${pl.emoji}</span>
        <b>${esc(pl.name)}</b><span class="steal-pts">${pl.score} pts</span></button>`).join("")}
    </div>
    <div class="hint" style="margin-top:12px">⏳ Si no eliges en 20 s, se robará automáticamente al que va ganando</div>
  </div>`;
  document.body.appendChild(d);
  d.querySelectorAll(".steal-target").forEach(b => b.onclick = () => {
    PlayerGame.client.send({ t: "stealpick", victim: b.dataset.n });
    closeStealPanel();
    toast("🔥 Robando a " + b.dataset.n + "...");
  });
  setTimeout(closeStealPanel, 21000);   // respaldo por si el evento no llega
}
function closeStealPanel() { const el = document.getElementById("steal-panel"); if (el) el.remove(); }

function renderStealToast(m) {
  const t = document.getElementById("p-steal");
  if (!t) return;
  t.classList.remove("hidden");
  t.textContent = `🔥 ¡${m.stealer} robó ${m.amount} pts a ${m.victim}!`;
  setTimeout(() => t.classList.add("hidden"), 5000);
}

function renderPlayerScores(scores, target) {
  const box = document.getElementById("p-scores");
  if (!box) return;
  // privacidad: cada jugador solo ve sus propios puntos
  const mine = scores.filter(p => p.name === PlayerGame.me.name);
  const won = mine.length && mine[0].score >= target;
  box.innerHTML = mine.map(p => `<div class="sb-row ${won?'leader':''}">
      <span class="dot" style="background:${p.color}"></span>${avatarHtml(p)}
      <b>${esc(p.name)}</b>
      ${won?'<span class="badge win">🏆 ¡LLEGASTE A LA META!</span>':''}
      <span class="pts">${p.score} pts</span></div>`).join("")
    || `<div class="hint">Aún no tienes puntos — ¡responde! 🎵</div>`;
}

function renderPlayerEnd(m) {
  const iWon = m.winner === PlayerGame.me.name;
  document.getElementById("player-view").innerHTML = `
  <div class="card end-box">
    <div class="trophy">${iWon ? "🏆" : "🎵"}</div>
    <h1>${iWon ? "¡GANASTE!" : esc(m.winner) + " ganó"}</h1>
    <p style="color:#bfe9e5">${m.reason==='meta' ? '🎯 Llegó a la meta de puntos' : m.reason==='tiempo' ? '⏱️ Se acabó el tiempo' : '🏁 El creador terminó la partida'}</p>
    <div class="scoreboard" style="max-width:420px;margin:18px auto;text-align:left">
      ${m.scores.map((p,i)=>`<div class="sb-row ${i===0?'leader':''}">
        <span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':'🎵'}</span>
        <span class="dot" style="background:${p.color}"></span>${avatarHtml(p)}
        <b>${esc(p.name)}</b><span class="pts">${p.score} pts</span></div>`).join("")}
    </div>
    <button class="btn" onclick="goHome()" style="max-width:300px;margin:0 auto">🏠 Volver al inicio</button>
  </div>`;
}
