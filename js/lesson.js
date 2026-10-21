(() => {
  const { data, state, ui } = window.MEGA;
  const search = new URLSearchParams(window.location.search);
  const requestedId = search.get("id");
  const requestedMode = search.get("mode");
  const unit = data.lessons.find((lesson) => String(lesson.id) === requestedId)
    || data.bonuses.find((bonus) => bonus.id === requestedId);

  if (!ui || !state || !unit || (data.lessons.includes(unit) && !state.isLessonUnlocked(unit.id))) {
    const required = Number(requestedId) > 1 ? Number(requestedId) - 1 : 1;
    window.location.replace(`learn.html?notice=locked&required=${required}`);
    return;
  }

  if (!window.MEGA.validateBank()) {
    document.querySelector("#task-title").textContent = "Не удалось загрузить задания";
    return;
  }

  const isBonus = data.bonuses.includes(unit);
  let isTest = !isBonus && requestedMode === "test";
  const lessonId = unit.id;
  const sourceTasks = isBonus ? unit.tasks : (isTest ? unit.test : unit.tasks);
  const taskTitle = document.querySelector("#task-title");
  const taskArea = document.querySelector("#task-area");
  const progress = document.querySelector("#lesson-progress");
  const livesContainer = document.querySelector(".lives");
  const livesCount = document.querySelector("#lives");
  const checkButton = document.querySelector("#check-btn");
  const feedback = document.querySelector("#feedback");
  const successPanel = document.querySelector(".feedback--success");
  const errorPanel = document.querySelector(".feedback--error");
  const errorExplanation = document.querySelector("[data-error-explanation]");
  const hintText = document.querySelector("#hint-text");
  const hintButton = document.querySelector("#hint-btn");
  const continueButton = document.querySelector("#continue-btn");
  const dismissButton = document.querySelector("[data-feedback-dismiss]");
  const testBadge = document.querySelector("#test-badge");
  const templates = [...document.querySelectorAll("[data-task-template]")];
  const praise = ["Отлично!", "Верно!", "Так держать!"];

  let queue = [];
  let currentTask = null;
  let currentSection = null;
  let selectedAnswer = null;
  let selectedBlocks = [];
  let matchedPairs = new Set();
  let attemptsByTask = new Map();
  let selectedTerm = null;
  let attemptCount = 0;
  let correctTasks = 0;
  let firstTryCorrect = 0;
  let questionsAnswered = 0;
  let lives = data.config.LIVES;
  let earnedXp = 0;
  let noErrors = true;
  let wrongForCurrent = false;
  let resultLesson = { correct: 0, total: 0, xp: 0 };
  let resultTest = null;
  let gameOver = false;
  let startedAt = Date.now();
  let testIndex = 0;

  taskTitle.textContent = isTest ? `Мини-тест: ${unit.title}` : unit.title;
  testBadge.hidden = !isTest;
  livesContainer.hidden = isTest;
  progress.max = sourceTasks.length;
  progress.value = 0;
  progress.setAttribute("aria-valuemax", String(sourceTasks.length));
  progress.setAttribute("aria-valuenow", "0");

  function setProgress(value) {
    progress.value = value;
    progress.textContent = `${value} из ${progress.max}`;
    progress.setAttribute("aria-valuenow", String(value));
  }

  function updateCheckState() {
    const matching = currentTask?.type === "matching";
    checkButton.hidden = Boolean(matching);
    checkButton.disabled = matching || selectedAnswer === null && selectedBlocks.length === 0;
  }

  function setAnswerSelection(button, group) {
    for (const option of group.querySelectorAll("button")) option.classList.remove("is-selected");
    button.classList.add("is-selected");
    selectedAnswer = button.dataset.answer;
    updateCheckState();
  }

  function renderChoice(task, section) {
    const heading = section.querySelector("h2");
    const options = ui.shuffle(task.options);
    const buttons = options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-card";
      button.dataset.answer = option.id;
      button.addEventListener("click", () => setAnswerSelection(button, section));

      const label = document.createElement("span");
      label.textContent = option.text;
      button.append(label);
      if (option.code) {
        const code = document.createElement("code");
        code.textContent = option.code;
        button.append(code);
      }
      return button;
    });
    section.replaceChildren(heading, ...buttons);
  }

  function renderHotkeys(task, section) {
    const heading = section.querySelector("h2");
    const question = section.querySelector("p");
    question.textContent = task.question;
    const buttons = ui.shuffle(task.options).map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.answer = option.id;
      button.setAttribute("aria-label", option.keys.join(" + "));
      button.addEventListener("click", () => setAnswerSelection(button, section));
      option.keys.forEach((key, index) => {
        if (index) button.append(document.createTextNode(" + "));
        const keycap = document.createElement("kbd");
        keycap.textContent = key;
        button.append(keycap);
      });
      return button;
    });
    section.replaceChildren(heading, question, ...buttons);
  }

  function renderBuilder(task, section) {
    const bank = section.querySelector(".lesson__block-bank");
    const answerZone = section.querySelector("#answer-zone");
    bank.replaceChildren();
    answerZone.replaceChildren();
    ui.shuffle(task.blocks.map((text, index) => ({ text, index }))).forEach(({ text, index }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.block = String(index);
      button.dataset.blockIndex = String(index);
      button.textContent = text;
      bank.append(button);
    });
  }

  function renderMatching(task, section) {
    const heading = section.querySelector("h2");
    const [terms, definitions] = section.querySelectorAll(".lesson__matching-column");
    terms.replaceChildren();
    definitions.replaceChildren();

    function createMatchButton(pair, index, side, text) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "match-option";
      button.dataset.match = `${side}-${index}`;
      button.dataset.matchSide = side;
      button.dataset.pairIndex = String(index);
      button.textContent = text;
      button.addEventListener("click", () => selectMatch(button, pair));
      return button;
    }

    const pairs = task.pairs.map((pair, index) => ({ pair, index }));
    ui.shuffle(pairs).forEach(({ pair, index }) => {
      terms.append(createMatchButton(pair, index, "term", pair.term));
    });
    ui.shuffle(pairs).forEach(({ pair, index }) => {
      definitions.append(createMatchButton(pair, index, "definition", pair.def));
    });
    section.prepend(heading);
  }

  function renderTask(task) {
    currentTask = task;
    currentSection = templates.find((section) => section.dataset.taskTemplate === task.type);
    selectedAnswer = null;
    selectedBlocks = [];
    matchedPairs = new Set();
    selectedTerm = null;
    attemptCount = attemptsByTask.get(task) || 0;
    wrongForCurrent = false;
    taskArea.dataset.taskType = task.type;
    taskArea.querySelector("p").textContent = task.question;

    for (const template of templates) template.hidden = template !== currentSection;

    if (task.type === "choice") renderChoice(task, currentSection);
    if (task.type === "hotkeys") renderHotkeys(task, currentSection);
    if (task.type === "builder") renderBuilder(task, currentSection);
    if (task.type === "matching") renderMatching(task, currentSection);

    if (isTest) {
      testBadge.textContent = `Тест · ${testIndex + 1}/${resultTest.total}`;
    }
    updateCheckState();
  }

  function renderNext() {
    if (queue.length === 0) {
      if (isTest) finishTest();
      else if (isBonus) finishBonus();
      else beginTest();
      return;
    }
    renderTask(queue[0]);
  }

  function answerText() {
    if (currentTask.type === "choice") {
      const answer = currentTask.options.find((option) => option.id === currentTask.answer);
      return answer.code ? `${answer.text} (${answer.code})` : answer.text;
    }
    if (currentTask.type === "hotkeys") {
      const answer = currentTask.options.find((option) => option.id === currentTask.answer);
      return answer.keys.join(" + ");
    }
    if (currentTask.type === "builder") return currentTask.answer.join(" ");
    return currentTask.pairs.map((pair) => `${pair.term} — ${pair.def}`).join("; ");
  }

  function markAnswerStates(correct) {
    if (currentTask.type === "choice" || currentTask.type === "hotkeys") {
      for (const button of currentSection.querySelectorAll("button[data-answer]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
        if (button.dataset.answer === currentTask.answer) button.classList.add("is-correct");
        else if (!correct && button.dataset.answer === selectedAnswer) button.classList.add("is-wrong");
      }
    } else if (currentTask.type === "builder") {
      for (const button of currentSection.querySelectorAll("button[data-block-index]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
        if (correct) button.classList.add("is-correct");
        else button.classList.add("is-wrong");
      }
    }
  }

  function openFeedback(correct) {
    markAnswerStates(correct);
    successPanel.hidden = !correct;
    errorPanel.hidden = correct;
    hintText.hidden = true;
    hintText.textContent = "";
    hintButton.textContent = "Подсказка";
    hintButton.hidden = isTest;
    dismissButton.hidden = true;
    continueButton.hidden = false;
    continueButton.textContent = correct ? "Продолжить" : "Понятно";
    if (correct) successPanel.textContent = praise[Math.floor(Math.random() * praise.length)];
    else errorExplanation.textContent = `Правильный ответ: ${answerText()}. ${currentTask.explain}`;
    feedback.hidden = false;
    feedback.classList.add("is-visible");
    checkButton.hidden = true;
    continueButton.focus();
  }

  function hideFeedback() {
    feedback.hidden = true;
    feedback.classList.remove("is-visible");
    successPanel.hidden = true;
    errorPanel.hidden = true;
    continueButton.hidden = true;
    checkButton.hidden = currentTask?.type === "matching";
  }

  function updateLives() {
    livesCount.textContent = String(lives);
    livesContainer.classList.remove("lives--hit");
    void livesContainer.offsetWidth;
    livesContainer.classList.add("lives--hit");
    window.setTimeout(() => livesContainer.classList.remove("lives--hit"), 400);
    if (lives <= 0) {
      livesContainer.classList.add("lives--empty");
      gameOver = true;
    }
  }

  function recordWrong() {
    noErrors = false;
    if (isTest) {
      attemptsByTask.set(currentTask, (attemptsByTask.get(currentTask) || 0) + 1);
      return;
    }
    if (wrongForCurrent) return;
    wrongForCurrent = true;
    attemptsByTask.set(currentTask, (attemptsByTask.get(currentTask) || 0) + 1);
    lives = Math.max(0, lives - 1);
    updateLives();
  }

  function showNoLivesModal() {
    ui.modal("Жизни закончились", "Можно начать урок заново или вернуться к карте.", [
      { label: "Начать заново", value: "restart", className: "btn btn--primary" },
      { label: "К карте уроков", value: "map", className: "btn btn--secondary" }
    ]).then((choice) => {
      if (choice === "restart") startLesson();
      else if (choice === "map") window.location.href = "learn.html";
    });
  }

  function handleCorrect() {
    if (!currentTask || feedback.classList.contains("is-visible")) return;
    const firstAttempt = (attemptsByTask.get(currentTask) || 0) === 0;
    if (firstAttempt && !isTest) firstTryCorrect += 1;
    questionsAnswered += 1;

    if (isTest) {
      resultTest.correct += 1;
    } else {
      correctTasks += 1;
      earnedXp += firstAttempt ? data.config.XP_FIRST_TRY : data.config.XP_RETRY;
      setProgress(progress.value + 1);
    }

    queue.shift();
    openFeedback(true);
  }

  function handleIncorrect() {
    if (!currentTask || feedback.classList.contains("is-visible")) return;
    recordWrong();
    markAnswerStates(false);

    if (!isTest) {
      queue.shift();
      queue.push(currentTask);
    } else {
      queue.shift();
    }
    questionsAnswered += 1;
    openFeedback(false);
  }

  function selectMatch(button) {
    if (feedback.classList.contains("is-visible") || button.classList.contains("is-matched")) return;
    const side = button.dataset.matchSide;
    const index = button.dataset.pairIndex;
    if (side === "term") {
      selectedTerm = index;
      for (const term of currentSection.querySelectorAll('[data-match-side="term"]')) term.classList.remove("is-selected");
      button.classList.add("is-selected");
      return;
    }

    if (selectedTerm === null) return;
    const termButton = currentSection.querySelector(`[data-match-side="term"][data-pair-index="${selectedTerm}"]`);
    if (selectedTerm === index) {
      matchedPairs.add(index);
      termButton.classList.remove("is-selected");
      termButton.classList.add("is-matched", "is-disabled");
      button.classList.add("is-matched", "is-disabled");
      termButton.disabled = true;
      button.disabled = true;
      selectedTerm = null;
      if (matchedPairs.size === currentTask.pairs.length) handleCorrect();
      return;
    }

    if (!wrongForCurrent) recordWrong();
    termButton.classList.add("is-wrong");
    button.classList.add("is-wrong");
    window.setTimeout(() => {
      termButton.classList.remove("is-wrong", "is-selected");
      button.classList.remove("is-wrong");
    }, 400);
    selectedTerm = null;
  }

  function handleBuilderClick(event) {
    const button = event.target.closest("button[data-block-index]");
    if (!button || !currentSection.contains(button) || button.disabled) return;
    const destination = button.parentElement.id === "answer-zone"
      ? currentSection.querySelector(".lesson__block-bank")
      : currentSection.querySelector("#answer-zone");
    destination.append(button);
    selectedBlocks = [...currentSection.querySelectorAll("#answer-zone [data-block-index]")]
      .map((block) => currentTask.blocks[Number(block.dataset.blockIndex)]);
    updateCheckState();
  }

  function checkAnswer() {
    if (!currentTask || checkButton.disabled || feedback.classList.contains("is-visible")) return;
    let correct = false;
    if (currentTask.type === "choice" || currentTask.type === "hotkeys") {
      correct = selectedAnswer === currentTask.answer;
    } else if (currentTask.type === "builder") {
      correct = selectedBlocks.length === currentTask.answer.length
        && selectedBlocks.every((block, index) => block === currentTask.answer[index]);
    }
    if (correct) handleCorrect();
    else handleIncorrect();
  }

  function continueTask() {
    const wasError = !errorPanel.hidden;
    hideFeedback();
    if (gameOver) {
      showNoLivesModal();
      return;
    }
    if (wasError && !isTest && currentTask.type === "matching") {
      return;
    }
    if (isTest) testIndex += 1;
    renderNext();
  }

  function resetSession(tasks, testMode = false, preserveLessonResult = false) {
    const previousLessonResult = resultLesson;
    const previousFirstTryCorrect = firstTryCorrect;
    const previousStartTime = startedAt;
    queue = tasks.slice();
    attemptsByTask = new Map();
    currentTask = null;
    selectedAnswer = null;
    selectedBlocks = [];
    matchedPairs = new Set();
    correctTasks = 0;
    firstTryCorrect = preserveLessonResult ? previousFirstTryCorrect : 0;
    questionsAnswered = 0;
    earnedXp = 0;
    noErrors = true;
    wrongForCurrent = false;
    attemptCount = 0;
    lives = data.config.LIVES;
    gameOver = false;
    testIndex = 0;
    resultLesson = preserveLessonResult ? previousLessonResult : { correct: 0, total: 0, xp: 0 };
    resultTest = testMode ? { correct: 0, total: tasks.length, passed: false } : null;
    startedAt = preserveLessonResult ? previousStartTime : Date.now();
    livesCount.textContent = String(lives);
    livesContainer.hidden = testMode;
    livesContainer.classList.remove("lives--empty", "lives--hit");
    testBadge.hidden = !testMode;
    progress.max = tasks.length;
    progress.value = 0;
    progress.setAttribute("aria-valuemax", String(tasks.length));
    setProgress(0);
    feedback.hidden = true;
    feedback.classList.remove("is-visible");
    successPanel.hidden = true;
    errorPanel.hidden = true;
    continueButton.hidden = true;
    checkButton.hidden = false;
    taskTitle.textContent = testMode ? `Мини-тест: ${unit.title}` : unit.title;
    renderNext();
  }

  function startLesson() {
    isTest = false;
    history.replaceState(null, "", `lesson.html?id=${lessonId}`);
    resetSession(sourceTasks, false);
  }

  function beginTest() {
    const tests = unit.test.slice(0, data.config.TEST_LENGTH);
    const questionCount = tests.length;
    ui.modal("Урок пройден!", `Теперь мини-тест из ${questionCount} вопросов.`, [
      { label: "Начать тест", value: "start", className: "btn btn--primary" }
    ]).then((choice) => {
      if (choice !== "start") return;
      if (noErrors) earnedXp += data.config.XP_PERFECT_BONUS;
      resultLesson = { correct: firstTryCorrect, total: unit.tasks.length, xp: earnedXp };
      isTest = true;
      history.replaceState(null, "", `lesson.html?id=${lessonId}&mode=test`);
      resetSession(tests, true, true);
    });
  }

  function finishTest() {
    const testAccuracy = resultTest.total ? resultTest.correct / resultTest.total : 0;
    resultTest.passed = testAccuracy >= data.config.PASS_RATIO;
    const lessonAccuracy = resultLesson.total
      ? resultLesson.correct / resultLesson.total
      : testAccuracy;
    const combinedTotal = resultLesson.total + resultTest.total;
    const combinedCorrect = resultLesson.correct + resultTest.correct;
    const accuracy = combinedTotal ? Math.round((combinedCorrect / combinedTotal) * 100) : Math.round(testAccuracy * 100);
    let totalXp = resultTest.passed ? data.config.XP_TEST_PASS + resultLesson.xp : 0;

    if (resultTest.passed) {
      state.completeLesson(lessonId, Math.round(lessonAccuracy * 100));
      state.addXp(totalXp);
      state.touchStreak();
      ui.updateStreak();
    }

    saveResult({
      kind: "lesson",
      lessonId,
      lesson: resultLesson,
      test: resultTest,
      totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      totalXp,
      passed: resultTest.passed,
      accuracy
    });
  }

  function finishBonus() {
    if (noErrors) earnedXp += data.config.XP_PERFECT_BONUS;
    const firstCompletion = state.completeBonus(lessonId);
    const totalXp = firstCompletion ? earnedXp : 0;
    if (firstCompletion) state.addXp(totalXp);
    state.touchStreak();
    ui.updateStreak();
    saveResult({
      kind: "bonus",
      lessonId,
      lesson: { correct: correctTasks, total: unit.tasks.length, xp: totalXp },
      test: null,
      totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      totalXp,
      passed: true,
      accuracy: unit.tasks.length ? Math.round((firstTryCorrect / unit.tasks.length) * 100) : 0
    });
  }

  function saveResult(result) {
    try {
      sessionStorage.setItem("mega-last-result", JSON.stringify(result));
    } catch {
      ui.toast("Не удалось сохранить итоги в этой вкладке.");
    }
    window.location.href = "results.html";
  }

  checkButton.addEventListener("click", checkAnswer);
  continueButton.addEventListener("click", (event) => {
    event.preventDefault();
    continueTask();
  });
  dismissButton.addEventListener("click", continueTask);
  hintButton.addEventListener("click", () => {
    const visible = !hintText.hidden;
    hintText.hidden = visible;
    hintText.textContent = visible ? "" : currentTask.hint || "";
    hintButton.textContent = visible ? "Подсказка" : "Скрыть подсказку";
    hintButton.setAttribute("aria-expanded", String(!visible));
  });
  document.querySelector(".lesson__block-bank").closest("[data-task-template]").addEventListener("click", handleBuilderClick);
  document.querySelector("#exit-btn").addEventListener("click", (event) => {
    event.preventDefault();
    ui.modal("Выйти?", "Прогресс этого прохождения потеряется.", [
      { label: "Остаться", value: "stay", className: "btn btn--secondary" },
      { label: "Выйти", value: "exit", className: "btn btn--danger" }
    ]).then((choice) => {
      if (choice === "exit") window.location.href = "learn.html";
    });
  });

  document.addEventListener("keydown", (event) => {
    if (document.querySelector("#modal[open]")) return;

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (!active.matches("button, a, input, textarea, select")) {
        event.preventDefault();
        if (!feedback.hidden && !continueButton.hidden) continueButton.click();
        else if (!checkButton.hidden && !checkButton.disabled) checkButton.click();
      }
    }

    if (!isTest && currentTask && (currentTask.type === "choice" || currentTask.type === "hotkeys") && /^[1-4]$/.test(event.key)) {
      const options = [...currentSection.querySelectorAll("button[data-answer]")];
      options[Number(event.key) - 1]?.click();
    }
  });

  if (isTest) {
    const tests = unit.test.slice(0, data.config.TEST_LENGTH);
    resultLesson = { correct: 0, total: 0, xp: 0 };
    resetSession(tests, true);
  } else {
    resetSession(sourceTasks, false);
  }
})();
