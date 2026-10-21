const themeRoot = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const themePreference = window.matchMedia("(prefers-color-scheme: dark)");
let themeTransitionTimer;
let isSwitching = false;

function readStoredTheme() {
  try {
    const storedTheme = localStorage.getItem("mega-theme");
    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
  } catch {
    return null;
  }
}

function setTheme(theme, animate = false, point = null) {
  const applyTheme = () => {
    themeRoot.dataset.theme = theme;
    if (themeToggle) {
      const isDark = theme === "dark";
      themeToggle.setAttribute("aria-pressed", String(isDark));
      themeToggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
    }
  };

  if (!animate || reducedMotion.matches) {
    applyTheme();
    return;
  }

  if (isSwitching) return;
  isSwitching = true;

  if (typeof document.startViewTransition === "function") {
    if (point) {
      themeRoot.style.setProperty("--theme-x", `${point.x}px`);
      themeRoot.style.setProperty("--theme-y", `${point.y}px`);
      const farthestX = Math.max(point.x, window.innerWidth - point.x);
      const farthestY = Math.max(point.y, window.innerHeight - point.y);
      themeRoot.style.setProperty("--theme-radius", `${Math.hypot(farthestX, farthestY)}px`);
    }
    try {
      const transition = document.startViewTransition(applyTheme);
      transition.finished.then(
        () => { isSwitching = false; },
        () => { isSwitching = false; }
      );
      return;
    } catch {
      // При недоступном API используем обычный переход.
    }
  }

  window.clearTimeout(themeTransitionTimer);
  themeRoot.classList.add("theme-transition");
  void themeRoot.offsetWidth;
  applyTheme();
  themeTransitionTimer = window.setTimeout(() => {
    themeRoot.classList.remove("theme-transition");
    isSwitching = false;
  }, 400);
}

const initialTheme = readStoredTheme() || (themePreference.matches ? "dark" : "light");
setTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", (event) => {
    if (isSwitching) return;
    const nextTheme = themeRoot.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("mega-theme", nextTheme);
    } catch {
      // Настройка темы останется только в текущей вкладке.
    }

    setTheme(nextTheme, true, { x: event.clientX, y: event.clientY });
  });
}
