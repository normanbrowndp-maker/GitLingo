const themeRoot = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const themePreference = window.matchMedia("(prefers-color-scheme: dark)");
let themeTransitionTimer;

function readStoredTheme() {
  try {
    const storedTheme = localStorage.getItem("mega-theme");
    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
  } catch {
    return null;
  }
}

function setTheme(theme, animate = false) {
  window.clearTimeout(themeTransitionTimer);
  if (animate && !reducedMotion.matches) themeRoot.classList.add("theme-transition");
  else themeRoot.classList.remove("theme-transition");

  themeRoot.dataset.theme = theme;
  if (themeToggle) {
    const isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
  }

  if (animate && !reducedMotion.matches) {
    themeTransitionTimer = window.setTimeout(() => {
      themeRoot.classList.remove("theme-transition");
    }, 260);
  }
}

const paramTheme = new URLSearchParams(window.location.search).get("theme");
const initialTheme = (paramTheme === "dark" || paramTheme === "light") ? paramTheme : (readStoredTheme() || (themePreference.matches ? "dark" : "light"));
setTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = themeRoot.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("mega-theme", nextTheme);
    } catch {
      // Настройка темы останется только в текущей вкладке.
    }

    setTheme(nextTheme, true);
  });
}

const homeBackground = document.querySelector(".home-background");
if (homeBackground) {
  const images = [...homeBackground.querySelectorAll("img")];
  const waitForImage = (image) => {
    const loaded = image.complete
      ? Promise.resolve(image.naturalWidth > 0)
      : new Promise((resolve) => {
        image.addEventListener("load", () => resolve(true), { once: true });
        image.addEventListener("error", () => resolve(false), { once: true });
      });
    return loaded.then((ok) => {
      if (!ok || typeof image.decode !== "function") return ok;
      try {
        return image.decode().then(() => true, () => false);
      } catch {
        return false;
      }
    });
  };

  Promise.all(images.map(waitForImage)).then((ready) => {
    if (ready.length === 2 && ready.every(Boolean)) document.body.dataset.homeAssetsReady = "true";
  });
}
