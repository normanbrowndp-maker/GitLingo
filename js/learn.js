(() => {
  const { data, state, ui } = window.MEGA;
  const lessonList = document.querySelector("#lesson-list");
  const bonusList = document.querySelector("#bonus-list");
  const resetButton = document.querySelector("#reset-progress");
  const continueLink = document.querySelector("#continue-learning");
  const changeLevelButton = document.querySelector("#change-level");
  const levels = ["Ничего", "Немного", "Уверенно"];
  let levelDialog;
  let levelDialogMode = "onboarding";

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
      const title = document.createElement("span");
      title.className = "lesson-node__title";
      title.textContent = `Урок ${lesson.id}: ${lesson.title}`;
      const description = document.createElement("span");
      description.className = "lesson-node__description";
      description.textContent = lesson.description;
      const statusLabel = document.createElement("span");
      statusLabel.className = "lesson-node__status";
      statusLabel.textContent = status === "completed" ? "Пройден" : (status === "open" ? "Доступен" : "Закрыт");
      link.append(title, description, statusLabel);

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
    const saved = state.get();
    const firstUnfinished = data.lessons.find((lesson) => !saved.lessons[String(lesson.id)].completed);
    continueLink.href = firstUnfinished ? `lesson.html?id=${firstUnfinished.id}` : "learn.html";
    continueLink.textContent = firstUnfinished ? "Продолжить" : "Все уроки пройдены";
    continueLink.setAttribute("aria-disabled", String(!firstUnfinished));
    ui.updateStreak();
  }

  function getLevelDialog() {
    if (levelDialog) return levelDialog;
    levelDialog = document.createElement("dialog");
    levelDialog.id = "level-dialog";
    levelDialog.className = "app-modal level-dialog";
    levelDialog.addEventListener("click", (event) => {
      if (event.target === levelDialog && levelDialogMode === "change") levelDialog.close("cancel");
    });
    levelDialog.addEventListener("cancel", (event) => {
      if (levelDialogMode === "onboarding") event.preventDefault();
    });
    levelDialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (levelDialogMode === "change") levelDialog.close("cancel");
    });
    levelDialog.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-level-action]");
      if (!button) return;
      const action = button.dataset.levelAction;
      if (action === "close") {
        if (levelDialogMode === "change") levelDialog.close("cancel");
        return;
      }
      if (action === "choose") {
        const level = button.dataset.level;
        if (!levels.includes(level)) return;
        if (level === "Уверенно") renderLevelConfirmation();
        else saveLevel(level);
        return;
      }
      if (action === "back") {
        renderLevelChoices();
        return;
      }
      if (action === "confirm") saveLevel("Уверенно");
    });
    document.body.append(levelDialog);
    return levelDialog;
  }

  function createLevelButton(label, action, className, level) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.levelAction = action;
    if (level) button.dataset.level = level;
    button.textContent = label;
    return button;
  }

  function renderLevelChoices(focusLevel) {
    const dialog = getLevelDialog();
    const isChange = levelDialogMode === "change";
    const heading = document.createElement("h2");
    heading.id = "level-dialog-title";
    heading.textContent = "Что ты уже знаешь о терминале и Git?";
    dialog.setAttribute("aria-labelledby", heading.id);

    const description = document.createElement("p");
    description.textContent = "Выбери уровень, чтобы настроить начало обучения.";
    const actions = document.createElement("div");
    actions.className = "app-modal__actions level-dialog__choices";
    const savedLevel = state.get().profile.level;
    const buttons = levels.map((level) => {
      const button = createLevelButton(level, "choose", "btn btn--secondary", level);
      button.setAttribute("aria-pressed", String(savedLevel === level));
      if (savedLevel === level) button.classList.add("is-selected");
      actions.append(button);
      return button;
    });

    const contents = [heading, description, actions];
    if (isChange) {
      const closeButton = createLevelButton("×", "close", "level-dialog__close");
      closeButton.setAttribute("aria-label", "Закрыть");
      contents.push(closeButton);
    }
    dialog.replaceChildren(...contents);
    (buttons.find((button) => button.dataset.level === focusLevel)
      || buttons.find((button) => button.dataset.level === savedLevel)
      || buttons[1]).focus();
  }

  function renderLevelConfirmation() {
    const dialog = getLevelDialog();
    const heading = document.createElement("h2");
    heading.id = "level-confirm-title";
    heading.textContent = "Подтвердить выбор уровня?";
    dialog.setAttribute("aria-labelledby", heading.id);
    const description = document.createElement("p");
    description.textContent = "Пропустить теорию и сразу пройти тест урока 1?";
    const actions = document.createElement("div");
    actions.className = "app-modal__actions";
    actions.append(
      createLevelButton("Назад", "back", "btn btn--secondary"),
      createLevelButton("Да, пропустить", "confirm", "btn btn--primary")
    );
    const contents = [heading, description, actions];
    if (levelDialogMode === "change") {
      const closeButton = createLevelButton("×", "close", "level-dialog__close");
      closeButton.setAttribute("aria-label", "Закрыть");
      contents.push(closeButton);
    }
    dialog.replaceChildren(...contents);
    actions.querySelector('[data-level-action="back"]').focus();
  }

  function saveLevel(level) {
    state.setProfileLevel(level);
    getLevelDialog().close("saved");
    if (levelDialogMode === "change") return;
    if (level !== "Уверенно") {
      window.location.href = "lesson.html?id=1";
    } else {
      window.location.href = "lesson.html?id=1&mode=test";
    }
  }

  function promptProfile(mode = "onboarding") {
    levelDialogMode = mode;
    const dialog = getLevelDialog();
    renderLevelChoices(mode === "onboarding" ? "Немного" : null);
    if (!dialog.open) dialog.showModal();
    const focusLevel = mode === "onboarding" ? "Немного" : state.get().profile.level;
    dialog.querySelector(`[data-level="${focusLevel}"]`)?.focus();
  }

  changeLevelButton.addEventListener("click", () => promptProfile("change"));
  continueLink.addEventListener("click", (event) => {
    if (continueLink.getAttribute("aria-disabled") === "true") event.preventDefault();
  });

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
      promptProfile("onboarding");
    });
  });

  const search = new URLSearchParams(window.location.search);
  if (search.get("notice") === "locked") {
    const required = Number(search.get("required")) || 1;
    ui.toast(`Сначала пройди урок ${required} и сдай тест.`);
    history.replaceState(null, "", "learn.html");
  }

  renderMap();
  if (!state.get().profile.level) promptProfile("onboarding");
})();
