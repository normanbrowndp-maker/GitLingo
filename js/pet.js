(() => {
  const state = window.MEGA?.state;
  if (!state) return;

  const xp = Math.max(0, Number(state.get().xp) || 0);
  const levels = [...document.querySelectorAll(".pet-levels li[data-level]")]
    .sort((first, second) => Number(first.dataset.level) - Number(second.dataset.level))
    .map((card) => ({
      xp: Number(card.querySelector("p span")?.textContent) || 0,
      name: card.querySelector("h3")?.childNodes[0]?.textContent.trim() || "",
      icon: card.querySelector("h3 use")?.getAttribute("href")?.slice(1) || "",
      card
    }));
  const currentIndex = levels.reduce((index, level, candidate) => xp >= level.xp ? candidate : index, 0);
  const current = levels[currentIndex];
  const next = levels[currentIndex + 1];
  const progress = document.querySelector("#pet-xp-progress");
  const currentPet = document.querySelector("[data-current-pet]");
  const currentTitle = document.querySelector(".pet-current h2");
  const progressLabel = document.querySelector(".pet-current p:last-child");
  const currentUse = currentPet?.querySelector("use");

  if (currentTitle) currentTitle.textContent = current.name;
  if (currentPet) {
    currentPet.setAttribute("aria-label", current.name);
    currentPet.dataset.xp = currentIndex === 0 && xp > 0 ? "earned" : "none";
  }
  if (currentUse) currentUse.setAttribute("href", `#${current.icon}`);
  if (progress) {
    const start = current.xp;
    const end = next ? next.xp : current.xp;
    const value = next ? Math.max(0, Math.min(100, ((xp - start) / (end - start)) * 100)) : 100;
    progress.max = 100;
    progress.value = value;
    progress.textContent = next ? `${xp - start} из ${end - start} XP` : "Максимальный уровень";
    if (progressLabel) progressLabel.textContent = next
      ? `${xp - start} из ${end - start} XP до следующего уровня`
      : "Максимальный уровень питомца";
  }

  for (const [index, level] of levels.entries()) {
    const card = level.card;
    const unlocked = xp >= level.xp;
    card.dataset.locked = String(!unlocked);
    if (level === current) card.setAttribute("aria-current", "step");
    else card.removeAttribute("aria-current");
    const lock = card.querySelector(".pet-level__lock");
    if (lock) lock.hidden = unlocked;
  }
})();
