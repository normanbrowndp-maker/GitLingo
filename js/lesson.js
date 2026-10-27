(() => {
  const { data, state, ui } = window.MEGA;
  const search = new URLSearchParams(window.location.search);
  const requestedId = search.get("id");
  const requestedMode = search.get("mode");
  const requestedTheory = requestedMode === "theory";
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
  const profileLevel = state.get().profile.level;
  const introScreen = document.querySelector("#lesson-intro");
  const theoryScreen = document.querySelector("#lesson-theory");
  const taskGuidance = document.querySelector("#task-guidance");
  const lessonFooter = document.querySelector(".lesson__footer");
  const openTheoryButton = document.querySelector("#open-theory-btn");
  const lessonSteps = [...document.querySelectorAll("#lesson-steps [data-step]")];
  const lessonName = isBonus ? unit.title : `Урок ${unit.id}`;
  document.documentElement.style.setProperty("--lesson-accent", unit.accent || "var(--text-muted)");
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
  let screen = isTest ? "test" : "intro";
  let theoryIndex = 0;
  let theoryReturnsToIntro = false;

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

  function setScreen(nextScreen) {
    screen = nextScreen;
    introScreen.hidden = screen !== "intro";
    theoryScreen.hidden = screen !== "theory";
    taskTitle.hidden = screen !== "tasks" && screen !== "test";
    taskArea.hidden = screen !== "tasks" && screen !== "test";
    taskGuidance.hidden = screen !== "tasks";
    lessonFooter.hidden = screen !== "tasks" && screen !== "test";
    progress.hidden = screen !== "tasks" && screen !== "test";
    testBadge.hidden = screen !== "test";
    livesContainer.hidden = screen !== "tasks";
    const labels = { intro: "Введение", theory: "Теория", tasks: "Задания", test: "Тест" };
    document.querySelector("#lesson-breadcrumb").textContent = `${lessonName} · ${labels[screen]}`;
    for (const step of lessonSteps) {
      const active = step.dataset.step === screen;
      step.classList.toggle("is-active", active);
      if (active) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      step.hidden = isBonus && step.dataset.step === "test";
    }
    if (screen === "test") taskTitle.textContent = `Мини-тест: ${unit.title}`;
    else if (screen === "tasks") taskTitle.textContent = unit.title;
  }

  function renderIntroduction() {
    document.querySelector("#lesson-intro-title").textContent = unit.title;
    document.querySelector("#lesson-description").textContent = unit.description || "";
    document.querySelector("#lesson-why").textContent = unit.why || "";
    const goals = document.querySelector("#lesson-goals");
    goals.replaceChildren(...unit.goals.map((goal) => {
      const item = document.createElement("li");
      item.textContent = goal;
      return item;
    }));
    document.querySelector("#skip-theory-btn").hidden = profileLevel !== "Немного";
    openTheoryButton.hidden = profileLevel !== "Уверенно";
  }

  function renderTheoryCard() {
    const card = unit.theory[theoryIndex];
    const container = document.querySelector("#theory-card");
    const heading = document.createElement("h2");
    heading.textContent = card.title;
    const text = document.createElement("p");
    text.textContent = card.text;
    const parts = [heading, text];
    if (card.code) {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = card.code;
      pre.append(code);
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn--secondary theory-copy";
      copy.textContent = "Копировать";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(card.code);
        } catch {
          copy.hidden = true;
        }
      });
      parts.push(pre, copy);
    }
    container.replaceChildren(...parts);
    const dots = document.querySelector("#theory-dots");
    dots.replaceChildren(...unit.theory.map((theoryCard, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Карточка ${index + 1}: ${theoryCard.title}`);
      if (index === theoryIndex) button.setAttribute("aria-current", "step");
      button.addEventListener("click", () => {
        theoryIndex = index;
        renderTheoryCard();
      });
      item.append(button);
      return item;
    }));
    document.querySelector("#theory-back").disabled = theoryIndex === 0;
    document.querySelector("#theory-next").textContent = theoryIndex === unit.theory.length - 1
      ? (theoryReturnsToIntro ? "К введению" : "К заданиям")
      : "Далее";
  }

  function showTheory(returnToIntro = false) {
    theoryReturnsToIntro = returnToIntro;
    theoryIndex = 0;
    renderTheoryCard();
    setScreen("theory");
  }

  function startTasks() {
    isTest = false;
    history.replaceState(null, "", `lesson.html?id=${lessonId}`);
    const taskCount = unit.tasks.length;
    const lastTwo = taskCount % 100;
    const lastOne = taskCount % 10;
    const taskWord = lastTwo >= 11 && lastTwo <= 14 ? "заданий"
      : (lastOne === 1 ? "задание" : (lastOne >= 2 && lastOne <= 4 ? "задания" : "заданий"));
    taskGuidance.textContent = `Сейчас будет ${taskCount} ${taskWord}, ошибки не страшны, за неверный ответ теряется жизнь.`;
    setScreen("tasks");
    resetSession(sourceTasks, false);
  }

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
    clearBuilderAnimations();
    const answerZone = section.querySelector("#answer-zone");
    bank.replaceChildren();
    answerZone.replaceChildren(builderHint);
    answerZone.classList.remove("is-wrong");
    builderHint.hidden = false;
    builderClearButton.disabled = true;
    ui.shuffle(task.blocks.map((text, index) => ({ text, index }))).forEach(({ text, index }, bankPosition) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.block = String(index);
      button.dataset.bankPosition = String(bankPosition);
      button.dataset.blockIndex = String(index);
      button.setAttribute("aria-label", `Добавить ${text}`);
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
    clearBuilderAnimations();
    builderStatus.textContent = "";
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
    function appendStateIcon(button, name) {
      if (!button.querySelector(".state-icon")) button.append(ui.icon(name, "icon state-icon"));
    }

    if (currentTask.type === "choice" || currentTask.type === "hotkeys") {
      for (const button of currentSection.querySelectorAll("button[data-answer]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
        if (button.dataset.answer === currentTask.answer) {
          button.classList.add("is-correct");
          appendStateIcon(button, "check");
        } else if (!correct && button.dataset.answer === selectedAnswer) {
          button.classList.add("is-wrong");
          appendStateIcon(button, "close");
        }
      }
    } else if (currentTask.type === "builder") {
      for (const button of currentSection.querySelectorAll("button[data-block-index]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
        if (correct) {
          button.classList.add("is-correct");
          appendStateIcon(button, "check");
        } else {
          button.classList.add("is-wrong");
          appendStateIcon(button, "close");
        }
      }
    }
  }

  function openFeedback(correct) {
    if (currentTask.type === "builder") builderClearButton.disabled = true;
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
    if (correct) successPanel.querySelector("span").textContent = praise[Math.floor(Math.random() * praise.length)];
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
      termButton.append(ui.icon("check", "icon state-icon"));
      button.append(ui.icon("check", "icon state-icon"));
      termButton.disabled = true;
      button.disabled = true;
      selectedTerm = null;
      if (matchedPairs.size === currentTask.pairs.length) handleCorrect();
      return;
    }

    if (!wrongForCurrent) recordWrong();
    termButton.classList.add("is-wrong");
    button.classList.add("is-wrong");
    termButton.append(ui.icon("close", "icon state-icon"));
    button.append(ui.icon("close", "icon state-icon"));
    window.setTimeout(() => {
      termButton.classList.remove("is-wrong", "is-selected");
      button.classList.remove("is-wrong");
      termButton.querySelector(".state-icon")?.remove();
      button.querySelector(".state-icon")?.remove();
    }, 400);
    selectedTerm = null;
  }
  function updateBuilderSelection() {
    const answerZone = currentSection.querySelector("#answer-zone");
    selectedBlocks = [...answerZone.querySelectorAll("[data-block-index]")]
      .map((block) => currentTask.blocks[Number(block.dataset.blockIndex)]);
    builderHint.hidden = selectedBlocks.length > 0;
    builderClearButton.disabled = selectedBlocks.length === 0;
    updateCheckState();
  }

  const builderClearButton = document.querySelector("[data-builder-clear]");
  const builderHint = document.querySelector("[data-builder-hint]");
  const builderStatus = document.querySelector("[data-builder-status]");
  const builderAnimations = new Set();

  function clearBuilderAnimations() {
    for (const animation of builderAnimations) animation.cancel();
    builderAnimations.clear();
  }

  function cancelBuilderAnimation(button) {
    for (const animation of builderAnimations) {
      if (animation.effect?.target === button) {
        animation.cancel();
        builderAnimations.delete(animation);
      }
    }
  }

  function returnBuilderBlock(button, bank) {
    const position = Number(button.dataset.bankPosition);
    const next = [...bank.querySelectorAll("button[data-block-index]")]
      .find((candidate) => Number(candidate.dataset.bankPosition) > position);
    bank.insertBefore(button, next || null);
    button.setAttribute("aria-label", `Добавить ${button.textContent}`);
  }

  function moveBuilderFocus(button) {
    try {
      button.focus({ preventScroll: true });
    } catch {
      button.focus();
    }
  }


  function handleBuilderClick(event) {
    const button = event.target.closest("button[data-block-index]");
    if (gameOver || feedback.classList.contains("is-visible") || !button
      || !currentSection.contains(button) || button.disabled) return;
    cancelBuilderAnimation(button);
    const answerZone = currentSection.querySelector("#answer-zone");
    const source = button.getBoundingClientRect();
    const bank = currentSection.querySelector(".lesson__block-bank");
    const destination = button.parentElement.id === "answer-zone"
      ? bank
      : answerZone;
    if (destination === bank) {
      returnBuilderBlock(button, bank);
      builderStatus.textContent = `Убрано: ${button.textContent}`;
    } else {
      answerZone.append(button);
      button.setAttribute("aria-label", `Убрать ${button.textContent}`);
      builderStatus.textContent = `Добавлено: ${button.textContent}`;
    }
    animateBlock(button, source);
    answerZone.classList.remove("is-wrong");
    updateBuilderSelection();
    moveBuilderFocus(button);
  }

  function animateBlock(button, source) {
    if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || typeof button.animate !== "function") return;
    const target = button.getBoundingClientRect();
    const animation = button.animate([
      { transform: `translate(${source.left - target.left}px, ${source.top - target.top}px)` },
      { transform: "translate(0, 0)" }
    ], { duration: 180, easing: "ease-out" });
    builderAnimations.add(animation);
    animation.onfinish = () => builderAnimations.delete(animation);
    animation.oncancel = () => builderAnimations.delete(animation);
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
    setScreen(testMode ? "test" : "tasks");
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
    startTasks();
  }

  function beginTest() {
    const tests = unit.test.slice(0, data.config.TEST_LENGTH);
    const questionCount = tests.length;
    const transitionText = screen === "intro"
      ? `Проверь свои знания в мини-тесте из ${questionCount} вопросов.`
      : `В уроке верно с первой попытки: ${firstTryCorrect} из ${unit.tasks.length}. Теперь мини-тест из ${questionCount} вопросов.`;
    ui.modal("Переходим к тесту", transitionText, [
      { label: "Начать тест", value: "start", className: "btn btn--primary" }
    ]).then((choice) => {
      if (choice !== "start") return;
      if (noErrors) earnedXp += data.config.XP_PERFECT_BONUS;
      resultLesson = { correct: firstTryCorrect, total: unit.tasks.length, xp: earnedXp };
      isTest = true;
      history.replaceState(null, "", `lesson.html?id=${lessonId}&mode=test`);
      taskGuidance.hidden = true;
      setScreen("test");
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

  function requestExit() {
    ui.modal("Выйти?", "Прогресс этого прохождения потеряется.", [
      { label: "Остаться", value: "stay", className: "btn btn--secondary" },
      { label: "Выйти", value: "exit", className: "btn btn--danger" }
    ]).then((choice) => {
      if (choice === "exit") window.location.href = "learn.html";
    });
  }

  document.querySelector("#start-lesson-btn").addEventListener("click", () => {
    if (profileLevel === "Уверенно") beginTest();
    else showTheory();
  });
  openTheoryButton.addEventListener("click", () => showTheory(true));
  document.querySelector("#skip-theory-btn").addEventListener("click", startTasks);
  document.querySelector("#theory-back").addEventListener("click", () => {
    if (theoryIndex === 0) {
      theoryReturnsToIntro = false;
      setScreen("intro");
      return;
    }
    theoryIndex -= 1;
    renderTheoryCard();
  });
  document.querySelector("#theory-next").addEventListener("click", () => {
    if (theoryIndex === unit.theory.length - 1) {
      if (theoryReturnsToIntro) {
        theoryReturnsToIntro = false;
        setScreen("intro");
        return;
      }
      startTasks();
      return;
    }
    theoryIndex += 1;
    renderTheoryCard();
  });

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
  builderClearButton.addEventListener("click", () => {
    if (gameOver || currentTask?.type !== "builder" || feedback.classList.contains("is-visible")) return;
    const answerZone = currentSection.querySelector("#answer-zone");
    const bank = currentSection.querySelector(".lesson__block-bank");
    const blocks = [...answerZone.querySelectorAll("button[data-block-index]")];
    blocks.forEach(cancelBuilderAnimation);
    const sources = blocks.map((block) => block.getBoundingClientRect());
    for (const [index, block] of blocks.entries()) {
      returnBuilderBlock(block, bank);
      animateBlock(block, sources[index]);
    }
    answerZone.classList.remove("is-wrong");
    updateBuilderSelection();
    builderStatus.textContent = "Ответ очищен";
    const firstBankBlock = bank.querySelector("button[data-block-index]");
    if (firstBankBlock) moveBuilderFocus(firstBankBlock);
    else builderClearButton.focus();
  });
  document.querySelector(".lesson__block-bank").closest("[data-task-template]").addEventListener("click", handleBuilderClick);
  document.querySelector("#exit-btn").addEventListener("click", (event) => {
    event.preventDefault();
    requestExit();
  });

  document.addEventListener("keydown", (event) => {
    if (document.querySelector("#modal[open]")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      requestExit();
      return;
    }

    if (screen === "theory" && event.key === "ArrowLeft") {
      event.preventDefault();
      document.querySelector("#theory-back").click();
      return;
    }
    if (screen === "theory" && event.key === "ArrowRight") {
      event.preventDefault();
      document.querySelector("#theory-next").click();
      return;
    }

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (!active.matches("button, a, input, textarea, select")) {
        event.preventDefault();
        if (screen === "intro") document.querySelector("#start-lesson-btn").click();
        else if (screen === "theory") document.querySelector("#theory-next").click();
        else if (!feedback.hidden && !continueButton.hidden) continueButton.click();
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
  } else if (requestedTheory) {
    renderIntroduction();
    showTheory();
  } else {
    renderIntroduction();
    setScreen("intro");
  }
})();
