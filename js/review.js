(() => {
  const { data, state } = window.MEGA;
  const total = document.querySelector("#review-total");
  const empty = document.querySelector("#review-empty");
  const groups = document.querySelector("#review-groups");
  const staleSection = document.querySelector("#review-stale-section");
  const staleList = document.querySelector("#review-stale-list");
  const message = document.querySelector("#review-message");
  if (!window.MEGA.validateBank()) {
    total.textContent = "Не удалось проверить очередь ошибок.";
    empty.hidden = false;
    empty.textContent = "Не удалось загрузить задания для проверки очереди. Вернитесь к обучению позже.";
    staleSection.hidden = true;
    return;
  }
  if (!state.getStorageStatus().writable) {
    total.textContent = "Не удалось проверить очередь ошибок.";
    empty.hidden = false;
    empty.textContent = "Локальный прогресс сейчас недоступен. Проверьте хранилище браузера и откройте страницу ещё раз.";
    staleSection.hidden = true;
    return;
  }
  const queue = state.get().mistakes.filter((entry) => entry.needsReview);
  const valid = [];
  const stale = [];

  for (const entry of queue) {
    const unit = entry.unitKind === "bonus"
      ? data.bonuses.find((item) => item.id === entry.unitId)
      : data.lessons.find((item) => String(item.id) === entry.unitId);
    const tasks = !unit ? [] : entry.phase === "test" && entry.unitKind === "lesson"
      ? unit.test.slice(0, data.config.TEST_LENGTH)
      : unit.tasks;
    const task = tasks[entry.taskIndex];
    const expectedId = task && state.questionId(entry.unitKind, entry.unitId, entry.phase, entry.taskIndex, task);
    if (!task || expectedId !== entry.id || task.type !== entry.type) {
      stale.push(entry);
      continue;
    }
    valid.push({ entry, unit, task });
  }

  total.textContent = `В очереди ${valid.length} ${valid.length === 1 ? "вопрос" : valid.length >= 2 && valid.length <= 4 ? "вопроса" : "вопросов"} для повторения.`;
  empty.hidden = valid.length > 0;
  empty.textContent = valid.length ? "" : stale.length
    ? "Нет доступных вопросов для разбора. Удалите устаревшие записи ниже или вернитесь к обучению."
    : (new URLSearchParams(window.location.search).has("done")
      ? "Разбор завершён. Новых ошибок в очереди нет."
      : "Пока нет ошибок для разбора. Они появятся после проверенного неправильного ответа.");
  groups.replaceChildren();

  const grouped = new Map();
  for (const item of valid) {
    const key = `${item.entry.unitKind}:${item.entry.unitId}`;
    if (!grouped.has(key)) grouped.set(key, { unit: item.unit, kind: item.entry.unitKind, items: [] });
    grouped.get(key).items.push(item);
  }

  for (const group of grouped.values()) {
    const card = document.createElement("article");
    card.className = "review-group";
    const heading = document.createElement("h2");
    heading.textContent = group.kind === "bonus" ? group.unit.title : `Урок ${group.unit.id}: ${group.unit.title}`;
    const count = document.createElement("p");
    count.textContent = `Вопросов для разбора: ${group.items.length}`;
    const questionList = document.createElement("ul");
    for (const item of group.items) {
      const row = document.createElement("li");
      const question = document.createElement("span");
      question.textContent = item.task.question;
      const phase = document.createElement("span");
      phase.className = "review-group__phase";
      phase.textContent = item.entry.phase === "test" ? "Тест" : "Практика";
      row.append(phase, question);
      questionList.append(row);
    }
    const action = document.createElement("a");
    action.className = "btn btn--primary";
    action.href = `lesson.html?id=${encodeURIComponent(group.unit.id)}&mode=review`;
    action.textContent = "Разобрать ошибки";
    card.append(heading, count, questionList, action);
    groups.append(card);
  }

  staleSection.hidden = stale.length === 0;
  staleList.replaceChildren();
  for (const entry of stale) {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${entry.unitKind === "bonus" ? "Бонус" : `Урок ${entry.unitId}`} · ${entry.phase === "test" ? "тест" : "практика"} · ${entry.type}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--secondary";
    remove.textContent = "Убрать неактуальную запись";
    remove.addEventListener("click", () => {
      remove.disabled = true;
      const result = state.removeMistake(entry.id);
      if (!result.ok) {
        remove.disabled = false;
        message.textContent = "Не удалось убрать запись. Проверьте хранилище и попробуйте ещё раз.";
        return;
      }
      message.textContent = result.removed ? "Неактуальная запись удалена." : "Эта запись уже убрана.";
      window.setTimeout(() => window.location.reload(), 0);
    });
    row.append(label, remove);
    staleList.append(row);
  }
})();
