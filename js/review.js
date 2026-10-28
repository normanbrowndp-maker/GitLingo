(() => {
  const { data, state, ui } = window.MEGA;
  const $ = (selector) => document.querySelector(selector);
  const home = $("#review-home");
  const session = $("#review-session");
  const summary = $("#review-summary");
  const groups = $("#review-groups");
  const staleSection = $("#review-stale-section");
  const staleList = $("#review-stale-list");
  const taskBody = $("#review-task-body");
  const feedback = $("#review-feedback");
  const feedbackContent = $("#review-feedback-content");
  const checkButton = $("#review-check");
  const continueButton = $("#review-continue");
  const retryButton = $("#review-save-retry");
  let sessionScope = null;
  let batch = [];
  let index = 0;
  let reviewed = 0;
  let fixed = 0;
  let heartsReturned = 0;
  let selectedAnswer = null;
  let selectedBlocks = [];
  let selectedTerm = null;
  let matched = new Set();
  let locked = false;
  let pendingSave = null;

  function el(tag, text = "", className = "") {
    const result = document.createElement(tag);
    result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function topicName(scope) {
    if (!scope) return "Все темы";
    const unit = scope.unitKind === "bonus"
      ? data.bonuses.find((item) => item.id === scope.unitId)
      : data.lessons.find((item) => String(item.id) === scope.unitId);
    return unit ? (scope.unitKind === "bonus" ? unit.title : `Урок ${unit.id}: ${unit.title}`) : "Выбранная тема";
  }

  function resolveQueue() {
    const valid = [];
    const stale = [];
    for (const entry of state.get().mistakes) {
      if (!entry.needsReview) continue;
      const unit = entry.unitKind === "bonus"
        ? data.bonuses.find((item) => item.id === entry.unitId)
        : data.lessons.find((item) => String(item.id) === entry.unitId);
      const tasks = !unit ? [] : entry.phase === "test" && entry.unitKind === "lesson"
        ? unit.test.slice(0, data.config.TEST_LENGTH)
        : unit.tasks;
      const task = tasks[entry.taskIndex];
      const id = task && state.questionId(entry.unitKind, entry.unitId, entry.phase, entry.taskIndex, task);
      const item = { id: entry.id, unitKind: entry.unitKind, unitId: entry.unitId, phase: entry.phase,
        taskIndex: entry.taskIndex, type: entry.type, reviewVersion: entry.reviewVersion, unit, task };
      if (!task || id !== entry.id || task.type !== entry.type) stale.push(item);
      else valid.push(item);
    }
    return { valid, stale };
  }

  function filterScope(items, scope) {
    return scope ? items.filter((item) => item.unitKind === scope.unitKind && String(item.unitId) === scope.unitId) : items;
  }

  function word(count) {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return "вопросов";
    if (last === 1) return "вопрос";
    if (last >= 2 && last <= 4) return "вопроса";
    return "вопросов";
  }

  function switchScreen(name) {
    home.hidden = name !== "home";
    session.hidden = name !== "session";
    summary.hidden = name !== "summary";
  }

  function updateHome() {
    state.refresh();
    const status = state.getStorageStatus();
    const error = $("#review-storage-error");
    groups.replaceChildren();
    staleList.replaceChildren();
    staleSection.hidden = true;
    $("#review-available").hidden = !status.writable;
    if (!status.writable || !window.MEGA.validateBank()) {
      $("#review-total").textContent = "Очередь пока недоступна.";
      $("#review-hearts-count").textContent = "—";
      $("#review-empty").hidden = true;
      $("#review-start-all").hidden = true;
      error.hidden = false;
      error.textContent = status.writable
        ? "Не удалось загрузить банк заданий. Вернитесь к обучению позже."
        : "Локальный прогресс сейчас недоступен. Проверьте хранилище браузера и откройте страницу ещё раз.";
      return;
    }
    error.hidden = true;
    error.textContent = "";
    const saved = state.get();
    const { valid, stale } = resolveQueue();
    $("#review-total").textContent = `${valid.length} ${word(valid.length)} для повторения`;
    $("#review-hearts-count").textContent = String(saved.hearts);
    const empty = $("#review-empty");
    empty.hidden = valid.length > 0 && stale.length === 0;
    $("#review-empty-title").textContent = stale.length && !valid.length ? "Нет доступных вопросов" : "Все ошибки разобраны";
    empty.querySelector("p").textContent = stale.length && !valid.length
      ? "Недоступные записи можно убрать ниже. Они не запускаются и не дают сердца."
      : "Здесь появятся вопросы после проверенных неправильных ответов. Можно продолжить обучение на карте.";
    $("#review-start-all").hidden = valid.length === 0;
    $("#review-available").hidden = valid.length === 0;

    const byTopic = new Map();
    for (const item of valid) {
      const key = `${item.unitKind}:${item.unitId}`;
      if (!byTopic.has(key)) byTopic.set(key, { unit: item.unit, kind: item.unitKind, items: [] });
      byTopic.get(key).items.push(item);
    }
    for (const [key, group] of byTopic) {
      const card = el("article", "", "review-group");
      card.style.setProperty("--lesson-accent", group.unit.accent || "var(--brand)");
      card.append(el("h2", group.kind === "bonus" ? group.unit.title : `Урок ${group.unit.id}: ${group.unit.title}`));
      card.append(el("p", `${group.items.length} ${word(group.items.length)}`, "review-group__count"));
      const list = el("ul", "", "review-group__questions");
      for (const item of group.items) {
        const row = el("li", "", "review-group__question");
        row.append(el("span", item.phase === "test" ? "Тест" : "Практика", "review-group__phase"));
        row.append(el("span", item.task.question));
        list.append(row);
      }
      const button = el("button", "Повторить эту тему", "btn btn--secondary");
      button.type = "button";
      button.addEventListener("click", () => startBatch({ key, unitKind: group.kind, unitId: String(group.unit.id) }));
      card.append(list, button);
      groups.append(card);
    }

    if (stale.length) {
      staleSection.hidden = false;
      staleSection.querySelector("p").textContent = "Эти записи не включаются в подборки и не дают сердца. Их можно убрать из очереди.";
      for (const item of stale) {
        const row = el("li", "", "review-stale-list__item");
        row.append(el("span", `${item.unit ? topicName({ unitKind: item.unitKind, unitId: String(item.unitId) }) : `Урок ${item.unitId}`} · ${item.phase === "test" ? "тест" : "практика"}`));
        const remove = el("button", "Убрать запись", "btn btn--secondary");
        remove.type = "button";
        remove.addEventListener("click", () => {
          remove.disabled = true;
          const result = state.removeMistake(item.id);
          if (!result.ok) {
            remove.disabled = false;
            error.hidden = false;
            error.textContent = "Не удалось убрать запись. Проверьте хранилище и попробуйте ещё раз.";
          } else updateHome();
        });
        row.append(remove);
        staleList.append(row);
      }
    }
  }

  function current() { return batch[index] || null; }

  function startBatch(scope = null) {
    state.refresh();
    if (!state.getStorageStatus().writable || !window.MEGA.validateBank()) { updateHome(); return; }
    const items = filterScope(resolveQueue().valid, scope).slice(0, 5);
    if (!items.length) { updateHome(); return; }
    sessionScope = scope ? { ...scope } : null;
    batch = items.map((item) => ({ ...item }));
    index = 0;
    reviewed = 0;
    fixed = 0;
    heartsReturned = 0;
    switchScreen("session");
    renderQuestion();
  }

  function updateSessionStats() {
    $("#review-question-count").textContent = `Вопрос ${Math.min(index + 1, batch.length)} из ${batch.length}`;
    $("#review-fixed-count").textContent = `Исправлено: ${fixed}`;
    const status = state.getStorageStatus();
    $("#review-session-hearts").textContent = status.writable ? String(state.get().hearts) : "—";
    const progress = $("#review-progress");
    progress.max = batch.length;
    progress.value = reviewed;
    progress.setAttribute("aria-valuemax", String(batch.length));
    progress.setAttribute("aria-valuenow", String(reviewed));
  }
  function solution(task) {
    if (task.type === "choice") {
      const option = task.options.find((item) => item.id === task.answer);
      return option.code ? `${option.text} (${option.code})` : option.text;
    }
    if (task.type === "hotkeys") return task.options.find((item) => item.id === task.answer).keys.join(" + ");
    if (task.type === "builder") return task.answer.join(" ");
    return task.pairs.map((pair) => `${pair.term} — ${pair.def}`).join("; ");
  }

  function renderOption(task, option, position, hotkey) {
    const button = el("button", "", hotkey ? "review-hotkey" : "choice-card");
    button.type = "button";
    button.dataset.answer = option.id;
    if (hotkey) {
      option.keys.forEach((key, i) => {
        if (i) button.append(document.createTextNode(" + "));
        button.append(el("kbd", key));
      });
      button.setAttribute("aria-label", `Вариант ${position + 1}: ${option.keys.join(" + ")}`);
    } else {
      button.append(el("span", option.text));
      if (option.code) button.append(el("code", option.code));
      button.setAttribute("aria-label", `Вариант ${position + 1}: ${option.text}${option.code ? `, ${option.code}` : ""}`);
    }
    button.append(el("kbd", String(position + 1), "choice-shortcut"));
    button.addEventListener("click", () => {
      if (locked) return;
      for (const other of taskBody.querySelectorAll("button[data-answer]")) other.classList.remove("is-selected");
      button.classList.add("is-selected");
      selectedAnswer = option.id;
      checkButton.disabled = false;
    });
    return button;
  }

  function renderBuilder(task) {
    const wrapper = el("section", "", "review-builder");
    wrapper.dataset.taskTemplate = "builder";
    const answerZone = el("div", "", "review-builder__answer");
    answerZone.setAttribute("aria-label", "Собранный ответ");
    const bank = el("div", "", "lesson__block-bank");
    bank.setAttribute("aria-label", "Банк блоков");
    const hint = el("p", "Выберите блоки в нужном порядке", "review-builder__hint");
    const clear = el("button", "Очистить ответ", "btn btn--secondary");
    clear.type = "button";

    function blockButton(i, chosen) {
      const button = el("button", task.blocks[i], "chip");
      button.type = "button";
      button.dataset.blockIndex = String(i);
      button.setAttribute("aria-label", `${chosen ? "Убрать" : "Добавить"} ${task.blocks[i]}`);
      button.addEventListener("click", () => {
        if (locked) return;
        selectedBlocks = chosen ? selectedBlocks.filter((n) => n !== i) : [...selectedBlocks, i];
        renderBuilder(task);
        taskBody.querySelector(`[data-block-index="${i}"]`)?.focus();
        checkButton.disabled = selectedBlocks.length === 0;
      });
      return button;
    }

    answerZone.append(hint);
    for (const i of selectedBlocks) answerZone.append(blockButton(i, true));
    for (let i = 0; i < task.blocks.length; i += 1) if (!selectedBlocks.includes(i)) bank.append(blockButton(i, false));
    clear.disabled = selectedBlocks.length === 0;
    clear.addEventListener("click", () => {
      if (locked) return;
      selectedBlocks = [];
      renderBuilder(task);
      taskBody.querySelector("[data-block-index]")?.focus();
      checkButton.disabled = true;
    });
    wrapper.append(answerZone, bank, clear);
    taskBody.replaceChildren(wrapper);
  }

  function renderMatching(task) {
    const wrapper = el("section", "", "review-matching");
    wrapper.dataset.taskTemplate = "matching";
    const count = el("p", `Пар найдено ${matched.size} из ${task.pairs.length}`, "matching-count");
    count.setAttribute("aria-live", "polite");
    const terms = el("div", "", "lesson__matching-column");
    const definitions = el("div", "", "lesson__matching-column");
    terms.setAttribute("aria-label", "Термины");
    definitions.setAttribute("aria-label", "Определения");

    function pairButton(i, side, text) {
      const button = el("button", text, "match-option");
      button.type = "button";
      button.dataset.pairIndex = String(i);
      button.dataset.matchSide = side;
      button.disabled = matched.has(i);
      if (matched.has(i)) button.classList.add("is-matched", "is-disabled");
      button.addEventListener("click", () => {
        if (locked || matched.has(i)) return;
        if (side === "term") {
          selectedTerm = i;
          for (const other of terms.querySelectorAll("button")) other.classList.toggle("is-selected", Number(other.dataset.pairIndex) === i);
          return;
        }
        if (selectedTerm === null) return;
        const term = selectedTerm;
        selectedTerm = null;
        if (!window.MEGA.taskChecks.matchingPair(term, i)) {
          submit(false, { kind: "matching", pairs: [{ termIndex: term, definitionIndex: i }] });
          return;
        }
        matched.add(i);
        for (const other of terms.querySelectorAll("button")) {
          if (Number(other.dataset.pairIndex) === i) other.classList.add("is-matched", "is-disabled");
        }
        button.disabled = true;
        button.classList.add("is-matched", "is-disabled");
        count.textContent = `Пар найдено ${matched.size} из ${task.pairs.length}`;
        if (matched.size === task.pairs.length) {
          const pairs = task.pairs.map((_, termIndex) => ({ termIndex, definitionIndex: termIndex }));
          submit(true, { kind: "matching", pairs });
        }
      });
      return button;
    }

    const termOrder = ui.shuffle(task.pairs.map((_, i) => i));
    const definitionOrder = ui.shuffle(task.pairs.map((_, i) => i));
    for (const i of termOrder) terms.append(pairButton(i, "term", task.pairs[i].term));
    for (const i of definitionOrder) definitions.append(pairButton(i, "definition", task.pairs[i].def));
    wrapper.append(count, terms, definitions);
    taskBody.replaceChildren(wrapper);
  }

  function renderQuestion() {
    const item = current();
    if (!item) { finishBatch(); return; }
    selectedAnswer = null;
    selectedBlocks = [];
    selectedTerm = null;
    matched = new Set();
    locked = false;
    pendingSave = null;
    feedback.hidden = true;
    continueButton.hidden = true;
    retryButton.hidden = true;
    checkButton.hidden = item.type === "matching";
    checkButton.disabled = true;
    taskBody.replaceChildren();
    $("#review-session-topic").textContent = topicName(sessionScope);
    $("#review-task-phase").textContent = `${topicName({ unitKind: item.unitKind, unitId: String(item.unitId) })} · ${item.phase === "test" ? "Вопрос из теста" : "Вопрос из практики"}`;
    $("#review-question-title").textContent = item.task.question;
    $("#review-instruction").textContent = "Ответьте самостоятельно. Неверный ответ не тратит сердца; после проверки появится объяснение.";
    updateSessionStats();
    if (item.type === "choice" || item.type === "hotkeys") {
      const options = el("section", "", item.type === "hotkeys" ? "review-option-grid review-option-grid--hotkeys" : "review-option-grid");
      for (const [position, option] of ui.shuffle(item.task.options).entries()) options.append(renderOption(item.task, option, position, item.type === "hotkeys"));
      taskBody.append(options);
    } else if (item.type === "builder") renderBuilder(item.task);
    else if (item.type === "matching") renderMatching(item.task);
    $("#review-question-title").focus({ preventScroll: true });
  }

  function appendAnswer(task, container = feedbackContent) {
    container.replaceChildren();
    if (task.type === "builder") {
      container.append(el("strong", "Правильная команда"));
      container.append(el("code", solution(task), "feedback__command"));
      container.append(el("p", task.explain));
    } else {
      container.append(el("p", `Правильный ответ: ${solution(task)}`));
      container.append(el("p", task.explain));
    }
  }

  function showFeedback(title, text, { answer = false, retry = false, next = false } = {}) {
    $("#review-feedback-title").textContent = title;
    if (answer) {
      feedbackContent.replaceChildren(el("p", text));
      const answerContent = el("div");
      feedbackContent.append(answerContent);
      appendAnswer(current().task, answerContent);
    } else if (text) feedbackContent.replaceChildren(el("p", text));
    retryButton.hidden = !retry;
    continueButton.hidden = !next;
    feedback.hidden = false;
    (next ? continueButton : retryButton).focus({ preventScroll: true });
  }
  function markConsidered() {
    reviewed += 1;
    updateSessionStats();
    for (const button of taskBody.querySelectorAll("button")) button.disabled = true;
    checkButton.hidden = true;
  }

  function showWrong(item, result) {
    pendingSave = null;
    locked = true;
    markConsidered();
    showFeedback(result.stale ? "Запись изменилась" : "Ответ пока неверный",
      result.stale ? "Очередь изменилась в другом окне. Этот ответ не изменил новую запись." : "Вопрос остаётся в очереди для следующей подборки.",
      result.stale ? { next: true } : { answer: true, next: true });
  }

  function showCorrect(result) {
    pendingSave = null;
    locked = true;
    markConsidered();
    if (!result.closed) {
      showFeedback("Запись уже обработана", "Её закрыли или обновили в другом окне. Повторной награды нет.", { next: true });
      return;
    }
    fixed += 1;
    heartsReturned += result.heartsAwarded;
    updateSessionStats();
    showFeedback("Ошибка исправлена", result.heartsAwarded
      ? "Ошибка исправлена. Возвращено 1 сердце."
      : "Ошибка исправлена. Сердца уже на максимуме.", { next: true });
  }

  function saveOutcome(outcome) {
    if (locked) return;
    locked = true;
    pendingSave = outcome;
    const item = current();
    const result = outcome.correct
      ? state.resolveReviewQuestion(item.id, item.reviewVersion)
      : state.recordQuestionError({
        id: item.id, unitKind: item.unitKind, unitId: String(item.unitId), phase: item.phase,
        taskIndex: item.taskIndex, type: item.type
      }, outcome.answer, false, item.reviewVersion);

    if (outcome.correct && result.ok) { showCorrect(result); return; }
    if (!outcome.correct && result.ok && (result.saved || result.stale)) { showWrong(item, result); return; }

    locked = false;
    checkButton.hidden = true;
    for (const button of taskBody.querySelectorAll("button")) button.disabled = true;
    showFeedback("Не удалось сохранить ответ", "Изменения очереди не сохранены. Проверьте хранилище браузера и повторите сохранение.", { retry: true });
  }

  function submit(correct, answer) {
    if (locked || !feedback.hidden || !current()) return;
    saveOutcome({ correct, answer });
  }

  function checkAnswer() {
    const item = current();
    if (!item || locked || checkButton.disabled || !feedback.hidden) return;
    let answer;
    let correct = false;
    if (item.type === "choice" || item.type === "hotkeys") {
      answer = { kind: "option", selected: selectedAnswer || "" };
      correct = window.MEGA.taskChecks.option(item.task, selectedAnswer);
    } else if (item.type === "builder") {
      const blocks = selectedBlocks.map((blockIndex) => item.task.blocks[blockIndex]);
      answer = { kind: "builder", blocks };
      correct = window.MEGA.taskChecks.builder(item.task, blocks);
    }
    submit(correct, answer);
  }

  function retrySave() {
    if (!pendingSave || locked) return;
    feedback.hidden = true;
    saveOutcome(pendingSave);
  }

  function nextQuestion() {
    if (continueButton.hidden || locked === false) return;
    continueButton.disabled = true;
    index += 1;
    if (index === batch.length) finishBatch();
    else renderQuestion();
    continueButton.disabled = false;
  }

  function finishBatch() {
    continueButton.hidden = true;
    switchScreen("summary");
    $("#review-summary-reviewed").textContent = String(reviewed);
    $("#review-summary-fixed").textContent = String(fixed);
    $("#review-summary-hearts").textContent = String(heartsReturned);
    state.refresh();
    const writable = state.getStorageStatus().writable;
    const { valid, stale } = writable ? resolveQueue() : { valid: [], stale: [] };
    const allLeft = valid.length;
    const topicLeft = filterScope(valid, sessionScope).length;
    $("#review-summary-all-left").textContent = writable ? String(allLeft) : "—";
    $("#review-summary-topic-row").hidden = !sessionScope;
    $("#review-summary-topic-left").textContent = writable ? String(topicLeft) : "—";
    $("#review-summary-continue").hidden = !writable || allLeft === 0;
    const message = !writable
      ? "Не удалось проверить оставшуюся очередь. Проверьте хранилище браузера."
      : allLeft === 0 && stale.length === 0
        ? "Все ошибки разобраны."
        : allLeft === 0
          ? "Доступных вопросов не осталось. Недоступные записи можно убрать в списке."
          : `В общей очереди осталось ${allLeft} доступных ${word(allLeft)}. Следующая подборка начнётся только по кнопке.`;
    $("#review-summary-message").textContent = message;
    $("#review-summary-title").focus({ preventScroll: true });
  }

  function returnHome() {
    switchScreen("home");
    updateHome();
    $("#review-title").focus({ preventScroll: true });
  }

  $("#review-start-all").addEventListener("click", () => startBatch());
  checkButton.addEventListener("click", checkAnswer);
  continueButton.addEventListener("click", nextQuestion);
  retryButton.addEventListener("click", retrySave);
  $("#review-session-exit").addEventListener("click", returnHome);
  $("#review-summary-list").addEventListener("click", returnHome);
  $("#review-summary-continue").addEventListener("click", () => {
    state.refresh();
    startBatch(filterScope(resolveQueue().valid, sessionScope).length ? sessionScope : null);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== "mega-state") return;
    state.refresh();
    if (session.hidden) updateHome();
    else updateSessionStats();
  });

  document.addEventListener("keydown", (event) => {
    if (session.hidden || event.key !== "Enter") return;
    const active = document.activeElement;
    if (active !== document.body && active !== document.documentElement) return;
    if (!feedback.hidden && !continueButton.hidden) {
      event.preventDefault();
      nextQuestion();
    } else if (!checkButton.hidden && !checkButton.disabled) {
      event.preventDefault();
      checkAnswer();
    }
  });

  updateHome();
})();
