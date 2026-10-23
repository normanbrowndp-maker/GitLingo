(() => {
  const { data, state, ui } = window.MEGA;
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
  const completedMessage = document.querySelector("#all-lessons-complete");
  const nextDescription = document.querySelector("#results-next-description");
  const goalsList = document.querySelector("#results-goals");
  const unit = data.lessons.find((lesson) => String(lesson.id) === String(result.lessonId))
    || data.bonuses.find((bonus) => bonus.id === String(result.lessonId));
  const test = result.test;
  const correct = result.lesson.correct + (test?.correct || 0);
  const total = result.lesson.total + (test?.total || 0);
  const accuracy = Number.isFinite(result.accuracy)
    ? result.accuracy
    : (total ? Math.round((correct / total) * 100) : 0);
  const elapsed = Math.max(0, Math.floor(Number(result.totalTimeSec) || 0));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  const isBonus = result.kind === "bonus";
  const passed = isBonus || Boolean(test && test.passed);

  goalsList.replaceChildren(...(unit?.goals || []).map((goal) => {
    const item = document.createElement("li");
    const marker = document.createElement("span");
    marker.setAttribute("aria-hidden", "true");
    marker.append(ui.icon(passed ? "check" : "close"));
    const text = document.createElement("span");
    text.textContent = goal;
    item.append(marker, text);
    return item;
  }));

  title.textContent = isBonus ? "Бонус пройден!" : (passed ? "Урок пройден!" : "Тест не сдан");
  document.querySelector("#stat-score").textContent = `верных ${correct} из ${total}`;
  document.querySelector("#stat-accuracy").textContent = `${accuracy}%`;
  document.querySelector("#stat-time").textContent = `${minutes}:${seconds}`;
  document.querySelector("#stat-xp").textContent = `+${Math.max(0, Number(result.totalXp) || 0)}`;
  document.querySelector("#results-streak > span").textContent = ui.streakLabel(state.get().streak);
  ui.updateStreak();

  if (!passed) {
    hint.hidden = false;
    hint.textContent = "Тест пока не сдан. Повтори теорию или попробуй тест ещё раз.";
    nextDescription.textContent = "Можно пересдать тест или вернуться к карточкам теории.";
    nextLink.hidden = true;
    nextBonusLink.hidden = true;
    retakeLink.hidden = false;
    retryLink.hidden = false;
    retakeLink.href = `lesson.html?id=${result.lessonId}&mode=test`;
    retryLink.href = `lesson.html?id=${result.lessonId}&mode=theory`;
    return;
  }

  retakeLink.hidden = true;
  retryLink.hidden = true;
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
