/* =========================================================
   MikuQuiz · js/theme.js — Sistema de Vocaloids (temas)
   - Miku: modo clásico (el creador pasa las preguntas)
   - Teto: temática rojo/rosa + avanza solo cuando
     todos los jugadores han respondido
   ========================================================= */

const THEMES = {
  miku: {
    id: "miku",
    name: "Hatsune Miku",
    icon: "https://i.ibb.co/SDB1rP4W/images-4.jpg",
    banner: "https://i.ibb.co/0pSkf5WP/images-3.jpg",
    autoNext: false
  },
  teto: {
    id: "teto",
    name: "Kasane Teto",
    icon: "https://i.ibb.co/XZnM29KK/images-1.jpg",
    banner: "https://i.ibb.co/zDzn6fF/images-3.jpg",
    autoNext: true
  }
};

let CURRENT_THEME = localStorage.getItem("mikuquiz_theme") || "miku";

function applyTheme(id) {
  if (!THEMES[id]) id = "miku";
  CURRENT_THEME = id;
  document.body.classList.toggle("theme-teto", id === "teto");
  document.body.classList.toggle("theme-miku", id === "miku");
  try { localStorage.setItem("mikuquiz_theme", id); } catch (e) {}
}
function themeBanner() { return THEMES[CURRENT_THEME].banner; }
function themeIcon()   { return THEMES[CURRENT_THEME].icon; }
function themeAutoNext(){ return THEMES[CURRENT_THEME].autoNext; }

applyTheme(CURRENT_THEME);
