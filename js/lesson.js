(() => {
  const { data, state, ui } = window.GitLingo;
  const search = new URLSearchParams(window.location.search);
  const requestedId = search.get("id");
  const requestedNodeId = search.get("node");
  const requestedMode = search.get("mode");
  if (requestedMode === "review") {
    window.location.replace("review.html");
    return;
  }
  const requestedTheory = requestedMode === "theory";
  const requestedPractice = requestedMode === "practice";
  const requestedRestart = requestedMode === "restart";
  const courseNode = (data.curriculumNodes || []).find((node) => node.nodeId === requestedNodeId);
  const isCourse = Boolean(courseNode);
  const courseUnit = isCourse ? data.courseUnits.find((entry) => entry.id === courseNode.unitId) : null;
  const unit = courseUnit || data.lessons.find((lesson) => String(lesson.id) === requestedId)
    || data.bonuses.find((bonus) => bonus.id === requestedId);
  const courseProgress = state?.getCourseProgress?.() || {};
  const courseNodeOpen = isCourse && courseNode.requires.every((required) => courseProgress[required] === true);

  if (!ui || !state || !unit || (isCourse && (!courseNodeOpen || courseNode.kind === "check" && state.get().hearts === 0)) || (!isCourse && data.lessons.includes(unit) && !state.isLessonUnlocked(unit.id))) {
    const required = Number(requestedId) > 1 ? Number(requestedId) - 1 : 1;
    window.location.replace(`learn.html?notice=locked&required=${required}`);
    return;
  }

  if (!window.GitLingo.validateBank()) {
    document.querySelector("#task-title").textContent = "Не удалось загрузить задания";
    return;
  }

  if (requestedMode === "test" && state.get().hearts === 0) {
    window.location.replace("learn.html?notice=no-hearts");
    return;
  }

  if (requestedRestart && state.get().hearts === 0) {
    const restored = state.restoreHearts();
    if (!restored.ok) {
      window.location.replace("learn.html?notice=storage-error");
      return;
    }
  }

  const isBonus = data.bonuses.includes(unit);
  let isTest = isCourse ? courseNode.kind === "check" : (!isBonus && requestedMode === "test");
  let isFreePractice = requestedPractice;
  const lessonId = unit.id;
  const profileLevel = state.get().profile.level;
  const introScreen = document.querySelector("#lesson-intro");
  const theoryScreen = document.querySelector("#lesson-theory");
  const taskGuidance = document.querySelector("#task-guidance");
  const lessonFooter = document.querySelector(".lesson__footer");
  const openTheoryButton = document.querySelector("#open-theory-btn");
  const freePracticeButton = document.querySelector("#free-practice-btn");
  const restartHeartsButton = document.querySelector("#restart-hearts-btn");
  const lessonSteps = [...document.querySelectorAll("#lesson-steps [data-step]")];
  const lessonName = isCourse ? unit.title : (isBonus ? unit.title : `Урок ${unit.id}`);
  document.documentElement.style.setProperty("--lesson-accent", unit.accent || "var(--text-muted)");
  const taskTitle = document.querySelector("#task-title");
  const taskArea = document.querySelector("#task-area");
  const progress = document.querySelector("#lesson-progress");
  const progressContainer = document.querySelector(".lesson-progress");
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
  const matchingCount = document.querySelector("[data-matching-count]");
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
  let correctTasks = 0;
  let firstTryCorrect = 0;
  let lives = state.get().hearts;
  let earnedXp = 0;
  let noErrors = true;
  let wrongAnswers = 0;
  let wrongForCurrent = false;
  let resultLesson = { correct: 0, total: 0, xp: 0 };
  let resultTest = null;
  let gameOver = false;
  let startedAt = Date.now();
  let testIndex = 0;
  let pendingLifeLoss = null;
  let continuingTask = false;
  let progressPulseTimer = null;
  let xpPopupTimer = null;
  let lastMistakeSave = null;

  function setScreen(nextScreen) {
    screen = nextScreen;
    const isPracticeMode = (screen === "tasks" && isFreePractice) || (isCourse && courseNode.kind === "practice");
    const isTestMode = screen === "test" || (isCourse && courseNode.kind === "check");
    const currentMode = isTestMode ? "test" : (isPracticeMode ? "practice" : "study");
    document.body.dataset.lessonMode = currentMode;
    const accentVar = (isTestMode || isPracticeMode) ? "var(--practice-accent)" : (isBonus ? (unit.accent || "var(--brand)") : "var(--brand)");
    document.documentElement.style.setProperty("--lesson-accent", accentVar);
    introScreen.hidden = screen !== "intro";
    theoryScreen.hidden = screen !== "theory";
    taskTitle.hidden = screen !== "tasks" && screen !== "test";
    taskArea.hidden = screen !== "tasks" && screen !== "test";
    taskGuidance.hidden = screen !== "tasks";
    lessonFooter.hidden = screen !== "tasks" && screen !== "test";
    progress.hidden = screen !== "tasks" && screen !== "test";
    progressContainer.hidden = progress.hidden;
    testBadge.hidden = screen !== "test";
    livesContainer.hidden = screen !== "tasks" && screen !== "test";
    const activeStep = lessonSteps.find((step) => step.dataset.step === screen);
    const stageLabel = isCourse && courseNode.kind !== "study"
      ? (courseNode.kind === "check" ? "Тест" : "Практика")
      : (activeStep?.textContent.trim() || screen);
    document.querySelector("#lesson-breadcrumb").textContent = `${lessonName} · ${stageLabel}`;
    const visibleSteps = lessonSteps.filter((step) => !(isBonus && step.dataset.step === "test"));
    const activeIndex = visibleSteps.indexOf(activeStep);
    for (const step of lessonSteps) {
      const active = step.dataset.step === screen;
      step.classList.toggle("is-active", active);
      const stepIndex = visibleSteps.indexOf(step);
      step.classList.toggle("is-completed", stepIndex >= 0 && stepIndex < activeIndex);
      step.classList.toggle("is-upcoming", stepIndex > activeIndex);
      if (active) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      step.hidden = isBonus && step.dataset.step === "test";
      const stateName = active ? "текущий этап" : (stepIndex >= 0 && stepIndex < activeIndex ? "завершён" : "предстоит");
      step.setAttribute("aria-label", `${step.textContent.trim()}: ${stateName}`);
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
    document.querySelector("#skip-theory-btn").hidden = isCourse || profileLevel !== "Немного";
    openTheoryButton.hidden = isCourse || profileLevel !== "Уверенно";
    freePracticeButton.hidden = isCourse || lives > 0;
    const openMistakes = state.get().mistakes.filter((entry) => entry.needsReview).length;
    restartHeartsButton.hidden = isCourse || lives > 0 || openMistakes > 0;
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

  function startTasks(options = {}) {
    isTest = false;
    history.replaceState(null, "", isCourse ? `lesson.html?node=${courseNode.nodeId}` : `lesson.html?id=${lessonId}`);
    isFreePractice = options.free === true || requestedPractice || lives === 0
      || (isCourse && state.getCourseProgress()["course-terminal-practice"] === true);
    const taskCount = unit.tasks.length;
    const lastTwo = taskCount % 100;
    const lastOne = taskCount % 10;
    const taskWord = lastTwo >= 11 && lastTwo <= 14 ? "заданий"
      : (lastOne === 1 ? "задание" : (lastOne >= 2 && lastOne <= 4 ? "задания" : "заданий"));
    taskGuidance.textContent = isFreePractice
      ? `Свободная повторная практика: ошибки не расходуют сердца, опыт и тест не засчитываются. Вопросов: ${taskCount}.`
      : `Сейчас будет ${taskCount} ${taskWord}. За неверный ответ теряется сердце; ошибочные вопросы можно разобрать отдельно.`;
    setScreen("tasks");
    resetSession(unit.tasks, false);
  }

  function setProgress(value, pulse = false) {
    progress.value = value;
    progress.textContent = `${value} из ${progress.max}`;
    progress.setAttribute("aria-valuenow", String(value));
    progressContainer.style.setProperty("--progress-position", `${progress.max ? value / progress.max * 100 : 0}%`);
    if (pulse) {
      window.clearTimeout(progressPulseTimer);
      progressContainer.classList.remove("progress--pulse");
      void progressContainer.offsetWidth;
      progressContainer.classList.add("progress--pulse");
      progressPulseTimer = window.setTimeout(() => {
        progressContainer.classList.remove("progress--pulse");
        progressPulseTimer = null;
      }, 500);
    }
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

  function shouldShowChoiceDescriptions() {
    const lessonOrder = data.lessons.indexOf(unit);
    return !isTest && !isFreePractice && !isCourse && !isBonus
      && state.get().profile.level === "Ничего"
      && lessonOrder >= 0 && lessonOrder < 3;
  }

  function renderChoice(task, section) {
    const heading = section.querySelector("h2");
    const options = ui.shuffle(task.options);
    const showDescriptions = task.type !== "choice" || shouldShowChoiceDescriptions();
    const buttons = options.map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-card";
      button.dataset.answer = option.id;
      const visibleText = !option.code || showDescriptions ? option.text : "";
      button.setAttribute("aria-label", `Вариант ${index + 1}: ${visibleText}${option.code ? `${visibleText ? ", " : ""}${option.code}` : ""}`);
      button.addEventListener("click", () => setAnswerSelection(button, section));

      if (visibleText) {
        const label = document.createElement("span");
        label.textContent = visibleText;
        button.append(label);
      }
      if (option.code) {
        const code = document.createElement("code");
        code.textContent = option.code;
        button.append(code);
      }
      const shortcut = document.createElement("kbd");
      shortcut.className = "choice-shortcut";
      shortcut.setAttribute("aria-hidden", "true");
      shortcut.textContent = String(index + 1);
      button.append(shortcut);
      return button;
    });
    section.replaceChildren(heading, ...buttons);
  }

  function renderHotkeys(task, section) {
    const heading = section.querySelector("h2");
    const question = section.querySelector("p");
    question.textContent = task.question;
    const buttons = ui.shuffle(task.options).map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.answer = option.id;
      button.setAttribute("aria-label", `Вариант ${index + 1}: ${option.keys.join(" + ")}`);
      button.addEventListener("click", () => setAnswerSelection(button, section));
      option.keys.forEach((key, index) => {
        if (index) button.append(document.createTextNode(" + "));
        const keycap = document.createElement("kbd");
        keycap.textContent = key;
        button.append(keycap);
      });
      const shortcut = document.createElement("kbd");
      shortcut.className = "choice-shortcut";
      shortcut.setAttribute("aria-hidden", "true");
      shortcut.textContent = String(index + 1);
      button.append(shortcut);
      return button;
    });
    section.replaceChildren(heading, question, ...buttons);
  }

  function renderBuilder(task, section) {
    const bank = section.querySelector(".lesson__block-bank");
    const answerZone = section.querySelector("#answer-zone");
    clearBuilderAnimations();
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
      button.dataset.blockIndex = String(index);
      button.dataset.bankPosition = String(bankPosition);
      button.textContent = text;
      button.setAttribute("aria-label", `Добавить ${text}`);
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
      button.addEventListener("click", () => selectMatch(button));
      button.addEventListener("animationend", () => button.classList.remove("match-flash"));
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
    matchingCount.textContent = `Пар найдено 0 из ${task.pairs.length}`;
  }

  function renderTask(task) {
    clearBuilderAnimations();
    builderStatus.textContent = "";
    currentTask = task;
    currentSection = templates.find((section) => section.dataset.taskTemplate === (task.type === "output-reading" ? "choice" : task.type));
    selectedAnswer = null;
    selectedBlocks = [];
    matchedPairs = new Set();
    selectedTerm = null;
    pendingLifeLoss = null;
    lastMistakeSave = null;
    wrongForCurrent = false;
    taskArea.dataset.taskType = task.type;
    if (task.scenarioStep) taskGuidance.textContent = `Самостоятельная практика · шаг ${task.scenarioStep} из 3. Это учебная модель Git Bash: команды на компьютере не запускаются.`;
    else if (isCourse && !isTest) taskGuidance.textContent = `Тренировка · ${unit.title}. Ситуация и вывод заданы в карточке.`;
    let context = taskArea.querySelector("[data-task-context]");
    if (context) context.remove();
    taskArea.querySelector(":scope > p").textContent = task.question;
    if (task.type === "output-reading") {
      context = document.createElement("div");
      context.dataset.taskContext = "";
      const environment = document.createElement("p");
      environment.textContent = `Среда: ${task.environment}`;
      const command = document.createElement("code");
      command.textContent = task.command;
      const output = document.createElement("pre");
      output.textContent = task.output;
      const question = document.createElement("p");
      question.textContent = "Выберите верное описание вывода.";
      context.append(environment, command, output, question);
      taskArea.insertBefore(context, taskArea.querySelector(":scope > p"));
    }

    for (const template of templates) template.hidden = template !== currentSection;

    if (task.type === "choice" || task.type === "output-reading") renderChoice(task, currentSection);
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
      else if (isCourse) finishPractice();
      else if (isFreePractice) finishPractice();
      else if (isBonus) finishBonus();
      else beginTest();
      return;
    }
    renderTask(queue[0]);
  }

  function answerText() {
    if (currentTask.type === "output-reading") return currentTask.options.find((option) => window.GitLingo.taskChecks.outputReading(currentTask, option.id))?.text || "разбор вывода";
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
    if (currentTask.type === "choice" || currentTask.type === "hotkeys" || currentTask.type === "output-reading") {
      for (const button of currentSection.querySelectorAll("button[data-answer]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
        const isCorrectOption = currentTask.type === "output-reading"
          ? window.GitLingo.taskChecks.outputReading(currentTask, button.dataset.answer)
          : button.dataset.answer === currentTask.answer;
        if (isCorrectOption) {
          button.classList.add("is-correct");
        } else if (!correct && button.dataset.answer === selectedAnswer) {
          button.classList.add("is-wrong");
        }
      }
    } else if (currentTask.type === "builder") {
      for (const button of currentSection.querySelectorAll("button[data-block-index]")) {
        button.classList.add("is-disabled");
        button.disabled = true;
      }
      builderClearButton.disabled = true;
    }
  }

  function openFeedback(correct) {
    markAnswerStates(correct);
    if (currentTask.type === "builder") builderClearButton.disabled = true;
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
    else if (currentTask.type === "builder") {
      const label = document.createElement("strong");
      label.textContent = "Правильная команда";
      const command = document.createElement("code");
      command.className = "feedback__command";
      command.textContent = answerText();
      const explanation = document.createElement("span");
      explanation.textContent = currentTask.explain;
      errorExplanation.replaceChildren(label, document.createElement("br"), command, document.createElement("br"), explanation);
    } else {
      errorExplanation.textContent = `Правильный ответ: ${answerText()}. ${currentTask.explain}`;
    }
    if (!correct && lastMistakeSave && !lastMistakeSave.saved) {
      const warning = document.createElement("span");
      warning.className = "lesson-save-warning";
      warning.textContent = lastMistakeSave.stale
        ? "Запись ошибки изменилась в другой вкладке. Обновите очередь перед продолжением."
        : "Не удалось сохранить изменение прогресса в этом браузере.";
      if (!errorExplanation.hasChildNodes()) errorExplanation.textContent = `Правильный ответ: ${answerText()}. ${currentTask.explain}`;
      errorExplanation.append(document.createElement("br"), warning);
    }
    if (!correct && currentTask.type === "builder") {
      currentSection.querySelector("#answer-zone").classList.add("is-wrong");
    }
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

  function loseLifeAfterBreak() {
    livesContainer.classList.remove("lives--break");
    void livesContainer.offsetWidth;
    livesContainer.classList.add("lives--break");
    pendingLifeLoss = new Promise((resolve) => {
      window.setTimeout(() => {
        livesContainer.classList.remove("lives--break");
        lives = state.get().hearts;
        livesCount.textContent = String(lives);
        if (lives === 0) {
          livesContainer.classList.add("lives--empty");
          gameOver = true;
          if (currentTask?.type === "matching" && !feedback.classList.contains("is-visible")) openFeedback(false);
        }
        resolve();
      }, 400);
    });
  }

  function currentTaskInfo() {
    const phase = isTest ? "test" : "practice";
    const unitKind = isCourse ? "course" : (isBonus ? "bonus" : "lesson");
    const tasks = isBonus ? unit.tasks : (phase === "test" ? unit.test.slice(0, data.config.TEST_LENGTH) : unit.tasks);
    const taskIndex = tasks.indexOf(currentTask);
    return {
      id: state.questionId(unitKind, String(lessonId), phase, taskIndex, currentTask),
      unitKind,
      unitId: String(lessonId),
      phase,
      taskIndex,
      type: currentTask.type
    };
  }

  function currentUserAnswer(override = null) {
    if (override) return override;
    if (currentTask.type === "choice" || currentTask.type === "hotkeys" || currentTask.type === "output-reading") return { kind: "option", selected: selectedAnswer || "" };
    if (currentTask.type === "builder") return { kind: "builder", blocks: selectedBlocks.slice() };
    return { kind: "matching", pairs: [] };
  }

  function recordWrong(answer = null) {
    noErrors = false;
    wrongAnswers += 1;
    attemptsByTask.set(currentTask, (attemptsByTask.get(currentTask) || 0) + 1);
    const losesHeart = !isFreePractice && !wrongForCurrent;
    lastMistakeSave = state.recordQuestionError(currentTaskInfo(), currentUserAnswer(answer), losesHeart);
    if (!isFreePractice) wrongForCurrent = true;
    if (lastMistakeSave.ok && lastMistakeSave.saved && losesHeart) loseLifeAfterBreak();
    return lastMistakeSave;
  }

  function showXpPopup(amount) {
    window.clearTimeout(xpPopupTimer);
    lessonFooter.querySelector(".xp-popup")?.remove();
    const popup = document.createElement("span");
    popup.className = "xp-popup";
    popup.setAttribute("aria-hidden", "true");
    popup.textContent = `+${amount} XP`;
    lessonFooter.append(popup);
    xpPopupTimer = window.setTimeout(() => {
      popup.remove();
      xpPopupTimer = null;
    }, 600);
  }

  function handleCorrect() {
    if (!currentTask || feedback.classList.contains("is-visible")) return;
    const firstAttempt = (attemptsByTask.get(currentTask) || 0) === 0;
    if (firstAttempt && !isTest) firstTryCorrect += 1;
    if (isTest) {
      resultTest.correct += 1;
      resultTest.answered += 1;
    } else {
      correctTasks += 1;
      if (!isFreePractice) {
        const xp = firstAttempt ? data.config.XP_FIRST_TRY : data.config.XP_RETRY;
        earnedXp += xp;
        showXpPopup(xp);
      }
    }
    setProgress(progress.value + 1, true);

    queue.shift();
    openFeedback(true);
  }

  function handleIncorrect() {
    if (!currentTask || feedback.classList.contains("is-visible")) return;
    recordWrong();

    if (!isTest) {
      if (!(isCourse && currentTask.scenarioStep)) {
        queue.shift();
        queue.push(currentTask);
      }
    } else {
      queue.shift();
      resultTest.wrong += 1;
      resultTest.answered += 1;
    }
    openFeedback(false);
  }

  function selectMatch(button) {
    if (gameOver || feedback.classList.contains("is-visible") || button.classList.contains("is-matched")) return;
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
    if (window.GitLingo.taskChecks.matchingPair(Number(selectedTerm), Number(index))) {
      matchedPairs.add(index);
      termButton.classList.remove("is-selected");
      termButton.classList.add("is-matched", "is-disabled");
      button.classList.add("is-matched", "is-disabled");
      termButton.classList.add("match-flash");
      button.classList.add("match-flash");
      termButton.disabled = true;
      button.disabled = true;
      selectedTerm = null;
      matchingCount.textContent = `Пар найдено ${matchedPairs.size} из ${currentTask.pairs.length}`;
      if (matchedPairs.size === currentTask.pairs.length) handleCorrect();
      return;
    }

    recordWrong({ kind: "matching", pairs: [{ termIndex: Number(selectedTerm), definitionIndex: Number(index) }] });
    termButton.classList.remove("is-selected");
    termButton.classList.add("is-wrong");
    button.classList.add("is-wrong");
    window.setTimeout(() => {
      termButton.classList.remove("is-wrong");
      button.classList.remove("is-wrong");
    }, 200);
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
    if (currentTask.type === "choice" || currentTask.type === "hotkeys" || currentTask.type === "output-reading") {
      correct = currentTask.type === "output-reading"
        ? window.GitLingo.taskChecks.outputReading(currentTask, selectedAnswer)
        : window.GitLingo.taskChecks.option(currentTask, selectedAnswer);
    } else if (currentTask.type === "builder") {
      correct = window.GitLingo.taskChecks.builder(currentTask, selectedBlocks);
    }
    if (correct) handleCorrect();
    else handleIncorrect();
  }

  async function continueTask() {
    if (continuingTask || feedback.hidden || continueButton.hidden) return;
    continuingTask = true;
    continueButton.disabled = true;

    try {
      if (pendingLifeLoss) {
        await pendingLifeLoss;
        pendingLifeLoss = null;
      }
      const wasError = !errorPanel.hidden;
      hideFeedback();
      if (gameOver) {
        finishInterruptedAttempt();
        return;
      }
      if (wasError && !isTest && currentTask.type === "matching") {
        return;
      }
      if (isTest) testIndex += 1;
      renderNext();
    } finally {
      continuingTask = false;
      continueButton.disabled = false;
    }
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
    earnedXp = 0;
    noErrors = true;
    wrongAnswers = testMode ? 0 : (preserveLessonResult ? resultLesson.errors || 0 : 0);
    wrongForCurrent = false;
    lives = state.get().hearts;
    gameOver = false;
    testIndex = 0;
    resultLesson = preserveLessonResult ? previousLessonResult : { correct: 0, firstTryCorrect: 0, total: 0, xp: 0, errors: 0 };
    resultTest = testMode ? { correct: 0, total: tasks.length, wrong: 0, answered: 0, passed: false, interrupted: false } : null;
    startedAt = preserveLessonResult ? previousStartTime : Date.now();
    livesCount.textContent = String(lives);
    livesContainer.hidden = false;
    livesContainer.classList.remove("lives--empty", "lives--hit", "lives--break");
    window.clearTimeout(progressPulseTimer);
    progressPulseTimer = null;
    progressContainer.classList.remove("progress--pulse");
    window.clearTimeout(xpPopupTimer);
    xpPopupTimer = null;
    lessonFooter.querySelector(".xp-popup")?.remove();
    testBadge.hidden = !testMode;
    setScreen(testMode ? "test" : "tasks");
    progress.max = tasks.length;
    progress.value = 0;
    progress.setAttribute("aria-valuemax", String(tasks.length));
    progressContainer.classList.remove("progress--pulse");
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
    if (state.get().hearts <= 0) {
      showTheory();
      ui.toast("Для новой попытки теста нужно хотя бы одно сердце. Теория и свободная практика доступны.");
      return;
    }
    const tests = unit.test.slice(0, data.config.TEST_LENGTH);
    const questionCount = tests.length;
    const transitionText = screen === "intro"
      ? `Проверь свои знания в мини-тесте из ${questionCount} вопросов.`
      : `В уроке верно с первой попытки: ${firstTryCorrect} из ${unit.tasks.length}. Теперь мини-тест из ${questionCount} вопросов.`;
    ui.modal("Переходим к тесту", transitionText, [
      { label: "Начать тест", value: "start", className: "btn btn--primary" }
    ]).then((choice) => {
      if (choice !== "start") return;
      // Практика попадает в результат только если в этой попытке она реально выполнялась;
      // иначе отдельный тест не должен смешиваться с непройденной практикой (0/10, заниженная точность).
      const practiceRan = correctTasks > 0 || firstTryCorrect > 0 || wrongAnswers > 0;
      resultLesson = practiceRan
        ? { correct: correctTasks, firstTryCorrect, total: unit.tasks.length, xp: earnedXp, errors: wrongAnswers }
        : { correct: 0, firstTryCorrect: 0, total: 0, xp: 0, errors: 0 };
      isTest = true;
      history.replaceState(null, "", `lesson.html?id=${lessonId}&mode=test`);
      taskGuidance.hidden = true;
      setScreen("test");
      resetSession(tests, true, true);
    });
  }

  function finishTest(interrupted = false) {
    const testAccuracy = resultTest.total ? resultTest.correct / resultTest.total : 0;
    resultTest.interrupted = interrupted;
    resultTest.passed = !interrupted && testAccuracy >= data.config.PASS_RATIO;
    resultTest.wrong = wrongAnswers;
    const lessonAccuracy = resultLesson.total
      ? (resultLesson.firstTryCorrect ?? resultLesson.correct) / resultLesson.total
      : testAccuracy;
    const combinedTotal = resultLesson.total + resultTest.total;
    const combinedCorrect = resultLesson.correct + resultTest.correct;
    const accuracy = combinedTotal ? Math.round((combinedCorrect / combinedTotal) * 100) : Math.round(testAccuracy * 100);
    let totalXp = resultTest.passed ? data.config.XP_TEST_PASS + resultLesson.xp : 0;

    if (isCourse) {
      const completion = resultTest.passed
        ? state.completeCourseNode(courseNode.nodeId, data.config.XP_TEST_PASS)
        : { ok: true, firstCompletion: false, xpAwarded: 0 };
      if (!completion.ok) totalXp = 0;
      else totalXp = completion.xpAwarded;
      saveResult({ kind: "course", courseNodeId: courseNode.nodeId, coursePhase: "check", lessonId,
        lesson: { correct: 0, total: 0, errors: 0, xp: 0 }, test: resultTest,
        totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)), totalXp,
        passed: resultTest.passed && completion.ok, interrupted, accuracy: Math.round(testAccuracy * 100),
        saveFailed: !completion.ok });
      return;
    }

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
      interrupted,
      accuracy
    });
  }

  function finishPractice() {
    if (isCourse) {
      const nodeId = courseNode.kind === "practice" ? courseNode.nodeId : "course-terminal-practice";
      if (!isFreePractice && noErrors) earnedXp += data.config.XP_PERFECT_BONUS;
      const alreadyComplete = state.getCourseProgress()[nodeId] === true;
      const completion = isFreePractice
        ? { ok: true, completed: alreadyComplete, firstCompletion: false, xpAwarded: 0 }
        : state.completeCourseNode(nodeId, earnedXp);
      if (!completion.ok) {
        ui.toast("Не удалось сохранить этап курса. Проверьте хранилище и повторите попытку.");
        return;
      }
      saveResult({ kind: "course", courseNodeId: nodeId, coursePhase: "practice", lessonId,
        lesson: { correct: correctTasks, total: unit.tasks.length, errors: wrongAnswers, xp: completion.xpAwarded },
        test: null, totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        totalXp: completion.xpAwarded, passed: Boolean(completion.completed || completion.firstCompletion), accuracy: unit.tasks.length ? Math.round((correctTasks / unit.tasks.length) * 100) : 0,
        practiceRecorded: Boolean(completion.completed || completion.firstCompletion), saveFailed: false });
      return;
    }
    saveResult({
      kind: "practice",
      lessonId,
      lesson: { correct: correctTasks, total: unit.tasks.length, errors: wrongAnswers, xp: 0 },
      test: null,
      totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      totalXp: 0,
      passed: false,
      accuracy: unit.tasks.length ? Math.round((correctTasks / unit.tasks.length) * 100) : 0
    });
  }

  function finishInterruptedAttempt() {
    if (isTest) {
      finishTest(true);
      return;
    }
    if (isCourse) {
      saveResult({ kind: "course", courseNodeId: courseNode.nodeId, coursePhase: "practice", lessonId,
        lesson: { correct: correctTasks, total: unit.tasks.length, errors: wrongAnswers, xp: 0 }, test: null,
        interrupted: true, totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        totalXp: 0, passed: false, accuracy: unit.tasks.length ? Math.round((correctTasks / unit.tasks.length) * 100) : 0 });
      return;
    }
    saveResult({
      kind: "lesson",
      lessonId,
      lesson: { correct: correctTasks, total: unit.tasks.length, errors: wrongAnswers, xp: 0 },
      test: null,
      interrupted: true,
      totalTimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      totalXp: 0,
      passed: false,
      accuracy: unit.tasks.length ? Math.round((correctTasks / unit.tasks.length) * 100) : 0
    });
  }

  function finishBonus() {
    if (isFreePractice) {
      finishPractice();
      return;
    }
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
    if (isCourse) {
      if (courseNode.kind === "study") showTheory();
      return;
    }
    if (requestedRestart) {
      startTasks();
      return;
    }
    if (profileLevel === "Уверенно" && lives > 0) beginTest();
    else showTheory();
  });
  freePracticeButton.addEventListener("click", () => startTasks({ free: true }));
  restartHeartsButton.addEventListener("click", () => {
    const restored = state.restoreHearts();
    if (!restored.ok) {
      ui.toast("Не удалось сохранить восстановление сердец. Попробуйте ещё раз.");
      return;
    }
    lives = restored.hearts;
    livesCount.textContent = String(lives);
    livesContainer.classList.remove("lives--empty");
    startTasks();
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
      if (isCourse && courseNode.kind === "study") {
        const saved = state.completeCourseNode(courseNode.nodeId);
        if (!saved.ok) {
          ui.toast("Не удалось сохранить этап. Проверьте хранилище и повторите попытку.");
          return;
        }
        window.location.href = "learn.html";
        return;
      }
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
  document.querySelector(".lesson__block-bank").closest("[data-task-template]").addEventListener("click", handleBuilderClick);
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

    if (currentTask && (currentTask.type === "choice" || currentTask.type === "hotkeys" || currentTask.type === "output-reading")
      && !event.target.closest("input, textarea, select, [contenteditable='true']")) {
      const options = [...currentSection.querySelectorAll("button[data-answer]")];
      const optionIndex = Number(event.key) - 1;
      if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < options.length) {
        event.preventDefault();
        options[optionIndex].click();
      }
    }
  });

  if (isTest) {
    const tests = unit.test.slice(0, data.config.TEST_LENGTH);
    resultLesson = { correct: 0, firstTryCorrect: 0, total: 0, xp: 0, errors: 0 };
    resetSession(tests, true);
  } else if (isCourse && courseNode.kind === "practice") {
    renderIntroduction();
    startTasks();
  } else if (requestedPractice) {
    renderIntroduction();
    startTasks({ free: true });
  } else if (requestedTheory) {
    renderIntroduction();
    showTheory();
  } else {
    renderIntroduction();
    setScreen("intro");
  }
})();
