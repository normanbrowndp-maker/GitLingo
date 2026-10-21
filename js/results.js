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
  const retakeLink = document.querySelector("#retake-test-link");
  const retryLink = document.querySelector("#retry-lesson-link");
  const completedMessage = document.querySelector("#all-lessons-complete");
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

  title.textContent = isBonus ? "Бонус пройден!" : (passed ? "Урок пройден!" : "Тест не сдан");
  document.querySelector("#stat-score").textContent = `верных ${correct} из ${total}`;
  document.querySelector("#stat-accuracy").textContent = `${accuracy}%`;
  document.querySelector("#stat-time").textContent = `${minutes}:${seconds}`;
  document.querySelector("#stat-xp").textContent = `+${Math.max(0, Number(result.totalXp) || 0)}`;
  document.querySelector("#results-streak").textContent = `🔥 ${ui.streakLabel(state.get().streak)}`;
  ui.updateStreak();

  if (!passed) {
    hint.hidden = false;
    hint.textContent = "Тест пока не сдан. Повтори урок и попробуй ещё раз.";
    nextLink.hidden = true;
    retakeLink.hidden = false;
    retryLink.hidden = false;
    retakeLink.href = `lesson.html?id=${result.lessonId}&mode=test`;
    retryLink.href = `lesson.html?id=${result.lessonId}`;
    return;
  }

  retakeLink.hidden = true;
  retryLink.hidden = true;
  if (isBonus) {
    nextLink.hidden = true;
    return;
  }

  const nextLesson = data.lessons.find((lesson) => lesson.id === Number(result.lessonId) + 1);
  if (nextLesson) {
    nextLink.hidden = false;
    nextLink.href = `lesson.html?id=${nextLesson.id}`;
  } else {
    nextLink.hidden = true;
    completedMessage.hidden = false;
  }
})();
