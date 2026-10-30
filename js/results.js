(() => {
  const { data, state, ui } = window.GitLingo;
  let result;
  try {
    const stored = sessionStorage.getItem("mega-last-result");
    result = stored ? JSON.parse(stored) : null;
  } catch {
    result = null;
  }

  if (!result || !result.kind || !result.lesson) {
    window.location.replace("learn.html");
    return;
  }

  const title = document.querySelector("#results-title");
  const hint = document.querySelector("#results-hint");
  const nextLink = document.querySelector("#next-lesson-link");
  const nextBonusLink = document.querySelector("#next-bonus-link");
  const retakeLink = document.querySelector("#retake-test-link");
  const retryLink = document.querySelector("#retry-lesson-link");
  const repeatPracticeLink = document.querySelector("#repeat-practice-link");
  const reviewLink = document.querySelector("#review-errors-link");
  const restartHeartsLink = document.querySelector("#restart-hearts-link");
  const noHeartsMessage = document.querySelector("#results-no-hearts");
  const completedMessage = document.querySelector("#all-lessons-complete");
  const nextDescription = document.querySelector("#results-next-description");
  const goalsList = document.querySelector("#results-goals");
  const testStatCard = document.querySelector("#test-stat-card");
  const saved = state.get();
  const storageWritable = state.getStorageStatus().writable;
  const unit = data.lessons.find((lesson) => String(lesson.id) === String(result.lessonId))
    || data.bonuses.find((bonus) => bonus.id === String(result.lessonId))
    || data.courseUnits?.find((course) => course.id === String(result.lessonId));
  const test = result.test;
  const isBonus = result.kind === "bonus";
  const interrupted = Boolean(result.interrupted || (test && test.interrupted));
  const passed = isBonus || Boolean(test && test.passed && !interrupted);

  goalsList.replaceChildren(...(unit?.goals || []).map((goal) => {
    const item = document.createElement("li");
    item.textContent = goal;
    return item;
  }));

  title.textContent = interrupted
    ? "Попытка прервана: закончились сердца"
    : (isBonus ? "Бонус пройден!" : (test ? (passed ? "Тест сдан" : "Тест не сдан") : "Практика завершена"));
  const practiceRan = result.lesson.total > 0;
  document.querySelector("#stat-score").textContent = practiceRan
    ? `${result.lesson.correct} из ${result.lesson.total}`
    : "Не выполнялась";
  document.querySelector("#stat-errors").textContent = String(Math.max(0,
    (practiceRan ? (Number(result.lesson.errors) || 0) : 0) + (Number(test && test.wrong) || 0)));
  document.querySelector("#stat-hearts").textContent = storageWritable ? String(saved.hearts) : "—";
  testStatCard.hidden = !test;
  if (test) {
    const unanswered = Math.max(0, test.total - (Number(test.answered) || 0));
    const required = Math.ceil(test.total * data.config.PASS_RATIO);
    document.querySelector("#stat-test").textContent = `Правильных ${test.correct} из ${test.total}`;
    const thresholdNote = document.querySelector("#test-threshold-note");
    thresholdNote.textContent = `Порог: ${Math.round(data.config.PASS_RATIO * 100)}% · нужно ${required} из ${test.total}`
      + (unanswered ? ` · не отвечено ${unanswered}` : "") + (test.wrong ? ` · ошибок ${test.wrong}` : "");
    thresholdNote.hidden = false;
  }

  const testOnly = test && !practiceRan;
  const total = practiceRan ? result.lesson.total + (test?.total || 0) : (test?.total || 0);
  const correct = practiceRan ? result.lesson.correct + (test?.correct || 0) : (test?.correct || 0);
  // Для отдельного теста точность считается только по тесту: непройденная практика не входит в расчёт.
  const accuracy = testOnly
    ? Math.round((test.correct / Math.max(1, test.total)) * 100)
    : (practiceRan && Number.isFinite(result.accuracy)
      ? result.accuracy
      : (total ? Math.round((correct / total) * 100) : 0));
  const elapsed = Math.max(0, Math.floor(Number(result.totalTimeSec) || 0));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  document.querySelector("#stat-accuracy").textContent = `${accuracy}%`;
  document.querySelector("#stat-time").textContent = `${minutes}:${seconds}`;
  document.querySelector("#stat-xp").textContent = `+${Math.max(0, Number(result.totalXp) || 0)}`;
  document.querySelector("#results-streak > span").textContent = ui.streakLabel(saved.streak);
  ui.updateStreak();

  const activeMistakes = saved.mistakes.filter((entry) => entry.needsReview);
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
  const availableMistakes = activeMistakes.filter((entry) => availableIds.has(entry.id)).length;
  reviewLink.hidden = !storageWritable || activeMistakes.length === 0;
  reviewLink.textContent = `Работа над ошибками (${availableMistakes})`;

  if (result.kind === "course") {
    const checking = result.coursePhase === "check";
    hint.hidden = !result.saveFailed;
    if (result.saveFailed) hint.textContent = "Этап не сохранён. Проверьте доступность локального хранилища и повторите действие.";
    nextBonusLink.hidden = true;
    nextLink.hidden = false;
    nextLink.href = "learn.html";
    nextLink.textContent = "К карте обучения";
    retryLink.hidden = true;
    repeatPracticeLink.hidden = checking;
    repeatPracticeLink.href = "lesson.html?node=course-terminal-practice";
    retakeLink.hidden = !checking || saved.hearts === 0;
    retakeLink.href = "lesson.html?node=course-terminal-check";
    restartHeartsLink.hidden = true;
    noHeartsMessage.hidden = !(checking && saved.hearts === 0 && !passed);
    if (checking) {
      nextDescription.textContent = result.saveFailed
        ? "Результат теста не записан в прогресс."
        : (passed ? "Контрольный этап пройден. Старые достижения и результаты других уроков не изменяются." : "Контрольный этап не пройден. Можно повторить практику или вернуться к карте.");
    } else {
      nextDescription.textContent = result.practiceRecorded
        ? "Учебная задача выполнена: команды не запускались на компьютере. Этап практики сохранён отдельно от старых уроков."
        : "Свободная повторная практика завершена. Она не засчитывает этап курса и не выдаёт XP.";
    }
    completedMessage.hidden = true;
    return;
  }

  if (interrupted || (test && !passed)) {
    hint.hidden = false;
    hint.textContent = interrupted
      ? "Попытка завершилась сразу после последнего сердца. Непроверенные вопросы теста отмечены отдельно."
      : "Тест не сдан. Число правильных ответов, ошибок и неотвеченных вопросов показано отдельно.";
    nextDescription.textContent = "Можно вернуться к теории, повторить практику без потери сердец или разобрать сохранённые ошибки.";
    nextLink.hidden = true;
    nextBonusLink.hidden = true;
    retakeLink.hidden = !test || saved.hearts === 0;
    retryLink.hidden = isBonus;
    repeatPracticeLink.hidden = false;
    retryLink.href = `lesson.html?id=${result.lessonId}&mode=theory`;
    repeatPracticeLink.href = `lesson.html?id=${result.lessonId}&mode=practice`;
    if (test && saved.hearts > 0) retakeLink.href = `lesson.html?id=${result.lessonId}&mode=test`;
    if (saved.hearts === 0) {
      noHeartsMessage.hidden = false;
      noHeartsMessage.textContent = activeMistakes.length
        ? "Сердца закончились. Разберите ошибки или повторите практику без списания сердец."
        : "Сердца закончились. На карте можно явно перезапустить урок и восстановить пять сердец.";
    }
    const restartLesson = data.lessons.find((lesson) => state.isLessonUnlocked(lesson.id));
    restartHeartsLink.hidden = !storageWritable || saved.hearts !== 0 || activeMistakes.length > 0 || !restartLesson;
    if (restartLesson) restartHeartsLink.href = `lesson.html?id=${restartLesson.id}&mode=restart`;
    return;
  }

  if (result.kind === "practice") {
    nextDescription.textContent = "Свободная практика завершена: она не начисляет XP и не засчитывает тест.";
    nextLink.hidden = true;
    nextBonusLink.hidden = true;
    retakeLink.hidden = true;
    retryLink.hidden = true;
    repeatPracticeLink.hidden = false;
    repeatPracticeLink.href = `lesson.html?id=${result.lessonId}&mode=practice`;
    restartHeartsLink.hidden = true;
    return;
  }

  retakeLink.hidden = true;
  retryLink.hidden = true;
  repeatPracticeLink.hidden = true;
  restartHeartsLink.hidden = true;
  if (isBonus) {
    nextLink.hidden = true;
    const bonusIndex = data.bonuses.findIndex((bonus) => bonus.id === String(result.lessonId));
    const nextBonus = data.bonuses[bonusIndex + 1];
    if (nextBonus) {
      nextBonusLink.hidden = false;
      nextBonusLink.href = `lesson.html?id=${nextBonus.id}`;
      nextBonusLink.textContent = nextBonus.title;
      nextDescription.textContent = "Продолжай с другим бонусным уроком или вернись к карте.";
    } else {
      nextBonusLink.hidden = true;
      nextDescription.textContent = "Бонус пройден. Можно вернуться к карте уроков.";
    }
    return;
  }

  const nextLesson = data.lessons.find((lesson) => lesson.id === Number(result.lessonId) + 1);
  if (nextLesson) {
    nextLink.hidden = false;
    nextLink.href = `lesson.html?id=${nextLesson.id}`;
    nextDescription.textContent = `Дальше: ${nextLesson.title}. Урок уже открыт на карте.`;
    nextBonusLink.hidden = true;
  } else {
    nextLink.hidden = true;
    nextBonusLink.hidden = false;
    nextBonusLink.href = `lesson.html?id=${data.bonuses[0].id}`;
    nextBonusLink.textContent = data.bonuses[0].title;
    nextDescription.textContent = "Основной курс завершён. Можно перейти к дополнительным темам.";
    completedMessage.hidden = false;
  }
})();
