window.MEGA = window.MEGA || {};

(() => {
  const key = "mega-state";
  const lessonIds = [1, 2, 3, 4, 5];
  const bonusIds = ["b1", "b2"];

  function createDefaultState() {
    return {
      v: 1,
      xp: 0,
      streak: 0,
      lastActiveDate: null,
      lessons: Object.fromEntries(lessonIds.map((id) => [String(id), {
        completed: false,
        bestAccuracy: 0,
        testPassed: false
      }])),
      bonuses: Object.fromEntries(bonusIds.map((id) => [id, { completed: false }]))
    };
  }

  function normalizeState(value) {
    if (!value || typeof value !== "object" || value.v !== 1) return null;
    if (!value.lessons || typeof value.lessons !== "object" || !value.bonuses || typeof value.bonuses !== "object") return null;

    const state = createDefaultState();
    state.xp = Number.isFinite(value.xp) && value.xp >= 0 ? Math.floor(value.xp) : 0;
    state.streak = Number.isFinite(value.streak) && value.streak >= 0 ? Math.floor(value.streak) : 0;
    state.lastActiveDate = typeof value.lastActiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.lastActiveDate)
      ? value.lastActiveDate
      : null;

    for (const id of lessonIds) {
      const saved = value.lessons[String(id)];
      if (!saved || typeof saved !== "object") continue;
      const bestAccuracy = Number(saved.bestAccuracy);
      state.lessons[String(id)] = {
        completed: Boolean(saved.completed && saved.testPassed),
        bestAccuracy: Number.isFinite(bestAccuracy) ? Math.min(100, Math.max(0, bestAccuracy)) : 0,
        testPassed: Boolean(saved.testPassed)
      };
    }

    for (const id of bonusIds) {
      const saved = value.bonuses[id];
      if (saved && typeof saved === "object") {
        state.bonuses[id] = { completed: Boolean(saved.completed) };
      }
    }

    if (!state.lastActiveDate) state.streak = 0;
    return state;
  }

  function saveState() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Состояние остаётся в памяти текущей вкладки.
    }
    return getState();
  }

  function readState() {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return createDefaultState();
      const parsed = normalizeState(JSON.parse(stored));
      return parsed || createDefaultState();
    } catch {
      return createDefaultState();
    }
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isTodayOrYesterday(dateString, today = new Date()) {
    if (!dateString) return false;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    yesterday.setDate(yesterday.getDate() - 1);
    return dateString === localDateString(today) || dateString === localDateString(yesterday);
  }

  let state = readState();
  saveState();

  function getState() {
    const snapshot = JSON.parse(JSON.stringify(state));
    if (!isTodayOrYesterday(snapshot.lastActiveDate)) snapshot.streak = 0;
    return snapshot;
  }

  window.MEGA.state = {
    get: getState,
    save: saveState,
    reset() {
      state = createDefaultState();
      return saveState();
    },
    isLessonUnlocked(id) {
      const number = Number(id);
      if (!Number.isInteger(number) || number < 1 || number > lessonIds.length) return false;
      if (number === 1) return true;
      const previous = state.lessons[String(number - 1)];
      return Boolean(previous && previous.completed && previous.testPassed);
    },
    completeLesson(id, accuracy) {
      const number = Number(id);
      if (!Number.isInteger(number) || !state.lessons[String(number)]) return false;
      const lesson = state.lessons[String(number)];
      lesson.completed = true;
      lesson.testPassed = true;
      lesson.bestAccuracy = Math.max(lesson.bestAccuracy, Math.min(100, Math.max(0, Number(accuracy) || 0)));
      saveState();
      return true;
    },
    completeBonus(id) {
      const bonus = state.bonuses[String(id)];
      if (!bonus) return false;
      const firstCompletion = !bonus.completed;
      bonus.completed = true;
      saveState();
      return firstCompletion;
    },
    addXp(amount) {
      if (Number.isFinite(amount) && amount > 0) {
        state.xp += Math.floor(amount);
        saveState();
      }
      return state.xp;
    },
    touchStreak() {
      const today = new Date();
      const todayString = localDateString(today);
      if (state.lastActiveDate !== todayString) {
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        yesterday.setDate(yesterday.getDate() - 1);
        state.streak = state.lastActiveDate === localDateString(yesterday) ? state.streak + 1 : 1;
        state.lastActiveDate = todayString;
        saveState();
      }
      return getState().streak;
    }
  };
})();
