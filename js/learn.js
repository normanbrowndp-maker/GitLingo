(() => {
  const { data, state, ui } = window.MEGA;
  const lessonList = document.querySelector("#lesson-list");
  const bonusList = document.querySelector("#bonus-list");
  const resetButton = document.querySelector("#reset-progress");

  if (!window.MEGA.validateBank()) return;

  function renderLessons() {
    const saved = state.get();
    lessonList.replaceChildren();

    for (const lesson of data.lessons) {
      const record = saved.lessons[String(lesson.id)];
      const status = record.completed
        ? "completed"
        : (state.isLessonUnlocked(lesson.id) ? "open" : "locked");
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "lesson-node";
      link.href = `lesson.html?id=${lesson.id}`;
      link.dataset.lessonId = String(lesson.id);
      link.dataset.status = status;
      link.textContent = lesson.title;

      if (status === "completed") {
        const meta = document.createElement("span");
        meta.className = "lesson-node__meta";
        meta.textContent = `✓ · точность ${Math.round(record.bestAccuracy)}%`;
        link.append(meta);
      }

      item.append(link);
      lessonList.append(item);
    }
  }

  function renderBonuses() {
    const saved = state.get();
    bonusList.replaceChildren();

    for (const [index, bonus] of data.bonuses.entries()) {
      const completed = Boolean(saved.bonuses[bonus.id]?.completed);
      const item = document.createElement("li");
      item.className = "bonus-card";
      const link = document.createElement("a");
      link.href = `lesson.html?id=${bonus.id}`;
      link.dataset.bonus = index === 0 ? "figma" : "vscode";
      link.dataset.bonusId = bonus.id;
      link.dataset.completed = String(completed);
      link.setAttribute("aria-label", completed ? `${bonus.title}, пройдено` : bonus.title);
      link.textContent = bonus.title;
      item.append(link);
      bonusList.append(item);
    }
  }

  function renderMap() {
    renderLessons();
    renderBonuses();
    ui.updateStreak();
  }

  lessonList.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-status=" + '"locked"' + "]");
    if (!link) return;
    event.preventDefault();
    link.classList.remove("lesson-node--shake");
    void link.offsetWidth;
    link.classList.add("lesson-node--shake");
    window.setTimeout(() => link.classList.remove("lesson-node--shake"), 400);
    ui.toast(`Сначала пройди урок ${Number(link.dataset.lessonId) - 1} и сдай тест.`);
  });

  resetButton.addEventListener("click", () => {
    ui.modal("Сбросить прогресс?", "Все уроки, бонусы, серия и накопленный опыт вернутся к началу.", [
      { label: "Отмена", value: "cancel", className: "btn btn--secondary" },
      { label: "Сбросить", value: "reset", className: "btn btn--danger" }
    ]).then((choice) => {
      if (choice !== "reset") return;
      state.reset();
      renderMap();
      ui.toast("Прогресс сброшен.");
    });
  });

  const search = new URLSearchParams(window.location.search);
  if (search.get("notice") === "locked") {
    const required = Number(search.get("required")) || 1;
    ui.toast(`Сначала пройди урок ${required} и сдай тест.`);
    history.replaceState(null, "", "learn.html");
  }

  renderMap();
})();
