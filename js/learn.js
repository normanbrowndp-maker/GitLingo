(() => {
  const { data, state, ui } = window.GitLingo;
  const lessonList = document.querySelector("#lesson-list");
  const bonusList = document.querySelector("#bonus-list");
  const courseNodeList = document.querySelector("#course-node-list");
  const courseList = courseNodeList?.querySelector(".course-node-list");
  const mapShell = document.querySelector("#learning-map");
  const mapConnectors = document.querySelector("#learning-map-connectors");
  const resetButton = document.querySelector("#reset-progress");
  const continueLink = document.querySelector("#continue-learning");
  const reviewLink = document.querySelector("#review-errors-link");
  const restartHeartsLink = document.querySelector("#restart-hearts-link");
  const changeLevelButton = document.querySelector("#change-level");
  const levels = ["Ничего", "Немного", "Уверенно"];
  let levelDialog;
  let levelDialogMode = "onboarding";
  let repeatChoiceOpen = false;

  if (!window.GitLingo.validateBank()) return;

  function createNode(entry, index) {
    const { status } = entry;
    const item = document.createElement("li");
    item.dataset.status = status;
    item.dataset.routeKind = entry.kind;

    const link = document.createElement("a");
    link.className = `lesson-node${entry.kind === "course" ? " lesson-node--course" : ""}`;
    link.href = entry.href;
    link.dataset.routeKind = entry.kind;
    link.dataset.status = status;
    link.dataset.side = index % 2 === 0 ? "left" : "right";
    link.dataset.current = String(entry.current);
    link.style.setProperty("--node-index", String(index));
    link.style.setProperty("--lesson-accent", entry.kind === "course" && entry.node.kind !== "study"
      ? "var(--practice-accent)" : "var(--brand)");
    link.style.setProperty("--lesson-accent-strong", entry.kind === "course" && entry.node.kind !== "study" ? "var(--practice-edge)" : "var(--brand-edge)");
    if (entry.kind === "lesson") link.dataset.lessonId = String(entry.lesson.id);
    if (entry.kind === "course") link.dataset.courseNode = entry.node.nodeId;
    if (status === "locked") link.setAttribute("aria-disabled", "true");

    const orb = document.createElement("span");
    orb.className = "lesson-node__orb";
    orb.setAttribute("aria-hidden", "true");
    if (status === "locked") orb.append(ui.icon("lock", "icon lesson-node__icon"));
    else if (status === "completed") orb.append(ui.icon("check", "icon lesson-node__icon"));
    else if (entry.kind === "course" && entry.node.kind === "study") orb.append(ui.icon("command", "icon lesson-node__icon"));
    else if (entry.kind === "course" && entry.node.kind === "practice") orb.append(ui.icon("code", "icon lesson-node__icon"));
    else if (entry.kind === "course" && entry.node.kind === "check") orb.append(ui.icon("choice", "icon lesson-node__icon"));
    else orb.textContent = String(entry.lesson.id);
    link.append(orb);

    const details = document.createElement("span");
    details.className = "lesson-node__details";
    const title = document.createElement("span");
    title.className = "lesson-node__title";
    const description = document.createElement("span");
    description.className = "lesson-node__description";
    const statusLabel = document.createElement("span");
    statusLabel.className = "lesson-node__status";

    if (entry.kind === "lesson") {
      title.textContent = `Урок ${entry.lesson.id}: ${entry.lesson.title}`;
      description.textContent = entry.lesson.description;
      statusLabel.textContent = status === "completed" ? "Пройдено"
        : (status === "locked" ? `После теста урока ${Math.max(1, entry.lesson.id - 1)}`
          : (entry.current ? "Текущий этап" : "Доступно"));
      if (status === "completed" && entry.record.bestAccuracy > 0) {
        const accuracy = document.createElement("span");
        accuracy.className = "lesson-node__meta";
        accuracy.textContent = `Точность ${Math.round(entry.record.bestAccuracy)}%`;
        details.append(accuracy);
      }
    } else {
      const kindLabel = entry.node.kind === "study" ? "Теория" : entry.node.kind === "practice" ? "Практика" : "Тест";
      title.textContent = entry.node.kind === "study" ? "Углубление: файловые пути"
        : entry.node.kind === "practice" ? "Практика с файловыми путями" : "Тест по файловым путям";
      description.textContent = entry.node.kind === "check"
        ? `${kindLabel} · ${Math.min(data.config.TEST_LENGTH, entry.unit.test.length)} вопросов`
        : `${kindLabel} · ${entry.unit.title}`;
      statusLabel.textContent = status === "completed" ? "Пройдено"
        : (status === "locked" ? (entry.heartLocked ? "Тест закрыт: нет сердец"
          : `После этапа «${entry.requiredTitle || "предыдущий этап"}»`)
          : (entry.current ? "Текущий этап" : "Доступно"));
    }

    details.prepend(title, description, statusLabel);
    let actionText = "";
    if (status === "completed") actionText = entry.kind === "lesson" ? "Повторить урок" : `Повторить: ${entry.node.title.toLowerCase()}`;
    else if (status === "open") {
      actionText = entry.kind === "lesson"
        ? (entry.lesson.id > 1 && entry.previousCompleted ? "Продолжить" : "Начать")
        : entry.node.kind === "study" ? "Изучить теорию" : entry.node.kind === "practice" ? "Начать практику" : "Пройти тест";
    }
    if (actionText) {
      const action = document.createElement("span");
      action.className = `lesson-node__action${status === "completed" ? " lesson-node__action--completed" : ""}`;
      action.textContent = actionText;
      details.append(action);
    }

    link.append(details);
    link.setAttribute("aria-label", [title.textContent, description.textContent, statusLabel.textContent, actionText,
      entry.kind === "course" && status !== "locked" ? "Открыть этап курса" : ""]
      .filter(Boolean).join(". "));
    item.append(link);
    return item;
  }

  function getRouteEntries() {
    const saved = state.get();
    const courseProgress = state.getCourseProgress();
    const lessonEntries = data.lessons.map((lesson) => {
      const record = saved.lessons[String(lesson.id)];
      const unlocked = state.isLessonUnlocked(lesson.id);
      return {
        kind: "lesson", lesson, record, unlocked, completed: record.completed,
        status: !unlocked ? "locked" : record.completed ? "completed" : "open",
        href: `lesson.html?id=${lesson.id}`,
        previousCompleted: lesson.id > 1 && saved.lessons[String(lesson.id - 1)]?.completed,
        heartLocked: false
      };
    });
    const courseEntries = (data.curriculumNodes || []).map((node) => {
      const unit = (data.courseUnits || []).find((course) => course.id === node.unitId);
      const missingPrerequisite = node.requires.find((required) => courseProgress[required] !== true);
      const heartLocked = node.kind === "check" && saved.hearts === 0;
      const completed = courseProgress[node.nodeId] === true;
      const unlocked = !missingPrerequisite && !heartLocked;
      const requiredNode = (data.curriculumNodes || []).find((candidate) => candidate.nodeId === missingPrerequisite);
      return {
        kind: "course", node, unit, completed, unlocked, heartLocked,
        status: !unlocked ? "locked" : completed ? "completed" : "open",
        requiredTitle: requiredNode?.title,
        href: `lesson.html?node=${encodeURIComponent(node.nodeId)}`
      };
    });
    const routeEntries = [...lessonEntries, ...courseEntries];
    const current = routeEntries.find((entry) => entry.unlocked && !entry.completed);
    routeEntries.forEach((entry, index) => {
      entry.current = Boolean(current && current === entry);
      entry.index = index;
    });
    return routeEntries;
  }

  function renderRoute(entries) {
    lessonList.replaceChildren();
    courseList.replaceChildren();
    entries.forEach((entry, index) => {
      const item = createNode(entry, index);
      (entry.kind === "lesson" ? lessonList : courseList).append(item);
    });
  }

  function pointFor(element, bounds) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
  }

  function appendConnector(from, to, completed, accent, kind = "route") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const deltaY = to.y - from.y;
    const bend = Math.max(24, Math.min(84, Math.abs(deltaY) * 0.42));
    const direction = Math.sign(to.x - from.x);
    const controlOffset = direction * Math.min(100, Math.abs(to.x - from.x) * 0.72);
    path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y + bend}, ${to.x - controlOffset} ${to.y - bend}, ${to.x} ${to.y}`);
    path.setAttribute("class", `learning-map__connector learning-map__connector--${kind}`);
    path.dataset.completed = String(completed);
    path.style.setProperty("--connector-accent", accent);
    mapConnectors.append(path);
  }

  function drawMapConnectors() {
    const bounds = mapShell.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    mapConnectors.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    mapConnectors.setAttribute("width", String(bounds.width));
    mapConnectors.setAttribute("height", String(bounds.height));
    mapConnectors.replaceChildren();

    const routeLinks = [...courseNodeList.querySelectorAll("a.lesson-node")];
    for (let index = 1; index < routeLinks.length; index += 1) {
      const previous = routeLinks[index - 1];
      appendConnector(pointFor(previous.querySelector(".lesson-node__orb"), bounds),
        pointFor(routeLinks[index].querySelector(".lesson-node__orb"), bounds),
        previous.dataset.status === "completed", previous.style.getPropertyValue("--lesson-accent"));
    }

    const bonusLinks = [...bonusList.querySelectorAll("a[data-bonus]")];
    const lastLink = routeLinks[routeLinks.length - 1];
    if (!lastLink) return;
    const start = pointFor(lastLink.querySelector(".lesson-node__orb"), bounds);
    for (const link of bonusLinks) {
      appendConnector(start, pointFor(link, bounds), link.dataset.completed === "true",
        link.dataset.bonus === "figma" ? "var(--bonus-figma)" : "var(--bonus-vscode)", "bonus");
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
      link.style.setProperty("--lesson-accent", bonus.accent || "var(--text-muted)");
      link.style.setProperty("--lesson-accent-strong", `color-mix(in srgb, ${bonus.accent || "var(--text-muted)"} 70%, #000)`);
      link.setAttribute("aria-label", completed ? `${bonus.title}, пройдено` : bonus.title);
      const icon = ui.icon(index === 0 ? "figma" : "vscode", "icon bonus-card__icon");
      icon.setAttribute("aria-hidden", "true");
      link.append(icon, document.createTextNode(bonus.title));
      if (completed) link.append(ui.icon("check", "icon bonus-check-icon"));
      item.append(link);
      bonusList.append(item);
    }
  }

  function renderMap() {
    const entries = getRouteEntries();
    renderRoute(entries);
    renderBonuses();
    const saved = state.get();
    const nextEntry = entries.find((entry) => entry.unlocked && !entry.completed);
    continueLink.href = nextEntry ? nextEntry.href : "learn.html";
    continueLink.textContent = nextEntry ? "Продолжить" : "Все этапы пройдены";
    continueLink.setAttribute("aria-disabled", String(!nextEntry));
    const storageWritable = state.getStorageStatus().writable;
    const queue = saved.mistakes.filter((entry) => entry.needsReview);
    const availableIds = new Set();
    for (const lesson of data.lessons) {
      for (const [phase, tasks] of [["practice", lesson.tasks], ["test", lesson.test.slice(0, data.config.TEST_LENGTH)]]) {
        tasks.forEach((task, index) => availableIds.add(state.questionId("lesson", String(lesson.id), phase, index, task)));
      }
    }
    for (const bonus of data.bonuses) {
      bonus.tasks.forEach((task, index) => availableIds.add(state.questionId("bonus", bonus.id, "practice", index, task)));
    }
    for (const course of data.courseUnits || []) {
      course.tasks.forEach((task, index) => availableIds.add(state.questionId("course", course.id, "practice", index, task)));
      course.test.forEach((task, index) => availableIds.add(state.questionId("course", course.id, "test", index, task)));
    }
    const actionable = queue.filter((entry) => availableIds.has(entry.id)).length;
    reviewLink.hidden = !storageWritable || queue.length === 0;
    reviewLink.textContent = `Работа над ошибками (${actionable})`;
    const restartLesson = data.lessons.find((lesson) => state.isLessonUnlocked(lesson.id));
    restartHeartsLink.hidden = !storageWritable || saved.hearts !== 0 || queue.length > 0 || !restartLesson;
    if (restartLesson) restartHeartsLink.href = `lesson.html?id=${restartLesson.id}&mode=restart`;
    requestAnimationFrame(drawMapConnectors);
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
    if (action === "close") button.append(ui.icon("close"));
    else button.textContent = label;
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
      const closeButton = createLevelButton("", "close", "level-dialog__close");
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
      const closeButton = createLevelButton("", "close", "level-dialog__close");
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

  courseNodeList.addEventListener("click", (event) => {
    const link = event.target.closest("a.lesson-node[data-status]");
    if (!link) return;
    if (link.dataset.status === "locked") {
      event.preventDefault();
      link.classList.remove("lesson-node--shake");
      void link.offsetWidth;
      link.classList.add("lesson-node--shake");
      window.setTimeout(() => link.classList.remove("lesson-node--shake"), 400);
      if (link.dataset.courseNode) {
        const entry = getRouteEntries().find((candidate) => candidate.kind === "course" && candidate.node.nodeId === link.dataset.courseNode);
        ui.toast(entry?.heartLocked ? "Тест закрыт: сначала восстановите хотя бы одно сердце."
          : `Сначала завершите этап «${entry?.requiredTitle || "предыдущий этап"}».`);
      } else {
        ui.toast(`Сначала пройди урок ${Math.max(1, Number(link.dataset.lessonId) - 1)} и сдай тест.`);
      }
      return;
    }

    if (link.dataset.routeKind !== "lesson" || link.dataset.status !== "completed") return;
    event.preventDefault();
    if (repeatChoiceOpen) return;
    repeatChoiceOpen = true;
    const lessonId = link.dataset.lessonId;
    ui.modal("Повторить урок?", "Выбери, с чего начать повторение.", [
      { label: "Повторить с начала", value: "begin", className: "btn btn--primary" },
      { label: "Повторить задания", value: "tasks", className: "btn btn--secondary" },
      { label: "Отмена", value: "cancel", className: "btn btn--secondary" }
    ]).then((choice) => {
      repeatChoiceOpen = false;
      if (choice === "begin") window.location.href = `lesson.html?id=${lessonId}`;
      if (choice === "tasks") window.location.href = `lesson.html?id=${lessonId}&mode=practice`;
    });
  });

  window.addEventListener("resize", () => requestAnimationFrame(drawMapConnectors), { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(() => requestAnimationFrame(drawMapConnectors));

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
  } else if (search.get("notice") === "no-hearts") {
    ui.toast("Тест закрыт: нет сердец. Откройте теорию, повторите практику или разберите ошибки.");
    history.replaceState(null, "", "learn.html");
  } else if (search.get("notice") === "storage-error") {
    ui.toast("Не удалось сохранить восстановление сердец. Проверьте хранилище браузера.");
    history.replaceState(null, "", "learn.html");
  }

  renderMap();
  if (!state.get().profile.level) promptProfile("onboarding");
})();
