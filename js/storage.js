window.MEGA = window.MEGA || {};

(() => {
  const key = "mega-state";
  const backupKey = "mega-state-backup-v1";
  const exportVersion = 1;
  const lessonIds = [1, 2, 3, 4, 5];
  const bonusIds = ["b1", "b2"];
  const profileLevels = ["Ничего", "Немного", "Уверенно"];

  function createDefaultState() {
    return {
      v: 1,
      xp: 0,
      streak: 0,
      lastActiveDate: null,
      profile: { level: null },
      lessons: Object.fromEntries(lessonIds.map((id) => [String(id), {
        completed: false,
        bestAccuracy: 0,
        testPassed: false
      }])),
      bonuses: Object.fromEntries(bonusIds.map((id) => [id, { completed: false }]))
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeStatus(kind, details = {}) {
    return { kind, writable: true, migrated: false, ...details };
  }

  let state = createDefaultState();
  let status = makeStatus("loading");
  let protectedRaw = null;

  function markProtected(kind, raw, errorType) {
    protectedRaw = raw;
    status = makeStatus(kind, {
      writable: false,
      hasSavedState: raw !== null,
      ...(errorType ? { errorType } : {})
    });
    state = createDefaultState();
  }

  function validateAndMigrate(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: "invalid-structure" };
    }
    const version = value.v;
    if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
      return { error: "invalid-structure" };
    }
    if (Number.isInteger(version) && version > 1) return { error: "unsupported-version" };
    if (version !== undefined && version !== 1) return { error: "invalid-structure" };

    const migrating = version === undefined;
    const defaults = createDefaultState();
    const result = { ...value, v: 1 };
    let changed = migrating;

    for (const field of ["xp", "streak"]) {
      if (!Object.prototype.hasOwnProperty.call(value, field)) {
        if (!migrating) return { error: "invalid-structure" };
        result[field] = defaults[field];
        changed = true;
      } else if (!Number.isFinite(value[field]) || value[field] < 0) {
        return { error: "invalid-structure" };
      }
    }
    if (!Object.prototype.hasOwnProperty.call(value, "lastActiveDate")) {
      if (!migrating) return { error: "invalid-structure" };
      result.lastActiveDate = null;
      changed = true;
    } else if (value.lastActiveDate !== null
      && (typeof value.lastActiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.lastActiveDate))) {
      return { error: "invalid-structure" };
    }

    if (!Object.prototype.hasOwnProperty.call(value, "profile")) {
      if (!migrating) return { error: "invalid-structure" };
      result.profile = defaults.profile;
      changed = true;
    } else if (!value.profile || typeof value.profile !== "object" || Array.isArray(value.profile)) {
      return { error: "invalid-structure" };
    } else if (!Object.prototype.hasOwnProperty.call(value.profile, "level")) {
      if (!migrating) return { error: "invalid-structure" };
      result.profile = { ...value.profile, level: null };
      changed = true;
    } else if (!(value.profile.level === null || profileLevels.includes(value.profile.level))) {
      return { error: "invalid-structure" };
    }

    for (const group of ["lessons", "bonuses"]) {
      if (!Object.prototype.hasOwnProperty.call(value, group)) {
        if (!migrating) return { error: "invalid-structure" };
        result[group] = defaults[group];
        changed = true;
      } else if (!value[group] || typeof value[group] !== "object" || Array.isArray(value[group])) {
        return { error: "invalid-structure" };
      } else {
        result[group] = { ...value[group] };
      }
    }

    for (const id of lessonIds) {
      const idKey = String(id);
      const saved = result.lessons[idKey];
      if (saved === undefined && migrating) {
        result.lessons[idKey] = defaults.lessons[idKey];
        changed = true;
        continue;
      }
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { error: "invalid-structure" };
      const lesson = { ...saved };
      for (const field of ["completed", "bestAccuracy", "testPassed"]) {
        if (!Object.prototype.hasOwnProperty.call(saved, field)) {
          if (!migrating) return { error: "invalid-structure" };
          lesson[field] = defaults.lessons[idKey][field];
          changed = true;
        }
      }
      if (typeof lesson.completed !== "boolean" || typeof lesson.testPassed !== "boolean"
        || !Number.isFinite(lesson.bestAccuracy) || lesson.bestAccuracy < 0 || lesson.bestAccuracy > 100) {
        return { error: "invalid-structure" };
      }
      result.lessons[idKey] = lesson;
    }

    for (const id of bonusIds) {
      const saved = result.bonuses[id];
      if (saved === undefined && migrating) {
        result.bonuses[id] = defaults.bonuses[id];
        changed = true;
        continue;
      }
      if (!saved || typeof saved !== "object" || Array.isArray(saved)
        || typeof saved.completed !== "boolean") return { error: "invalid-structure" };
      result.bonuses[id] = { ...saved };
    }

    return { state: result, changed };
  }

  function writeSerialized(serialized, allowProtected = false) {
    if (!status.writable && !allowProtected) {
      status.lastWriteError = "protected-state";
      return { ok: false, error: "protected-state" };
    }
    try {
      localStorage.setItem(key, serialized);
      protectedRaw = null;
      status = makeStatus("ok", { hasSavedState: true });
      return { ok: true };
    } catch (error) {
      const errorType = error && error.name === "QuotaExceededError" ? "quota-exceeded" : "write-failed";
      status.lastWriteError = errorType;
      return { ok: false, error: errorType };
    }
  }

  function persist(nextState, options = {}) {
    let serialized;
    try {
      serialized = JSON.stringify(nextState);
      if (typeof serialized !== "string") throw new TypeError("not-serializable");
    } catch {
      status.lastWriteError = "serialization-failed";
      return { ok: false, error: "serialization-failed" };
    }

    if (options.backupRaw !== undefined) {
      try {
        const existingBackup = localStorage.getItem(backupKey);
        if (existingBackup === null) localStorage.setItem(backupKey, options.backupRaw);
        else if (existingBackup !== options.backupRaw) {
          status = makeStatus("backup-conflict", { writable: false, hasSavedState: true });
          protectedRaw = options.backupRaw;
          return { ok: false, error: "backup-conflict" };
        }
      } catch (error) {
        const errorType = error && error.name === "QuotaExceededError" ? "quota-exceeded" : "backup-failed";
        status = makeStatus("backup-failed", { writable: false, hasSavedState: true, errorType });
        protectedRaw = options.backupRaw;
        return { ok: false, error: errorType };
      }
    }

    const result = writeSerialized(serialized, options.allowProtected === true);
    if (result.ok) state = nextState;
    return result;
  }

  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      markProtected("storage-unavailable", null, error && error.name === "SecurityError" ? "access-denied" : "read-failed");
      return;
    }
    if (raw === null) {
      state = createDefaultState();
      status = makeStatus("missing", { hasSavedState: false });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      markProtected("corrupt-json", raw, "syntax-error");
      return;
    }
    const checked = validateAndMigrate(parsed);
    if (checked.error) {
      markProtected(checked.error, raw);
      return;
    }
    state = checked.state;
    if (checked.changed) {
      status = makeStatus("migration-pending", { hasSavedState: true, migrated: true });
      const result = persist(state, { backupRaw: raw });
      if (!result.ok) {
        // Keep the validated state available in memory, but protect the source string.
        protectedRaw = raw;
        if (status.kind !== "backup-conflict" && status.kind !== "backup-failed") {
          status = makeStatus("migration-write-failed", { writable: false, hasSavedState: true, migrated: true, errorType: result.error });
        }
      } else {
        status.migrated = true;
      }
      return;
    }
    status = makeStatus("ok", { hasSavedState: true });
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

  function getState() {
    const snapshot = clone(state);
    if (!isTodayOrYesterday(snapshot.lastActiveDate)) snapshot.streak = 0;
    return snapshot;
  }

  function saveState(options = {}) {
    const result = persist(state, { allowProtected: options.allowProtected === true });
    return result.ok ? getState() : false;
  }

  loadState();

  window.MEGA.state = {
    get: getState,
    save: saveState,
    getStorageStatus() {
      return clone(status);
    },
    exportProgress() {
      if (["corrupt-json", "invalid-structure", "unsupported-version", "storage-unavailable", "backup-failed", "backup-conflict", "migration-write-failed", "reset-write-failed"].includes(status.kind)) {
        const error = new Error(`Progress export unavailable: ${status.kind}`);
        error.code = status.kind;
        throw error;
      }
      return JSON.stringify({ exportVersion, createdAt: new Date().toISOString(), progress: clone(state) });
    },
    getStoredStateRaw() {
      if (protectedRaw !== null) return { ok: true, status: status.kind, raw: protectedRaw };
      if (!status.hasSavedState) return { ok: false, status: status.kind, error: "no-saved-state" };
      try {
        return { ok: true, status: status.kind, raw: localStorage.getItem(key) };
      } catch (error) {
        return { ok: false, status: "storage-unavailable", error: error && error.name === "SecurityError" ? "access-denied" : "read-failed" };
      }
    },
    reset() {
      const previousStatus = clone(status);
      const previousRaw = protectedRaw;
      state = createDefaultState();
      status.writable = true;
      const result = persist(state, { allowProtected: true });
      if (!result.ok) {
        protectedRaw = previousRaw;
        status = makeStatus("reset-write-failed", {
          writable: false,
          hasSavedState: previousStatus.hasSavedState === true,
          errorType: result.error
        });
      }
      return getState();
    },
    setProfileLevel(level) {
      if (!profileLevels.includes(level)) return false;
      state.profile.level = level;
      saveState();
      return true;
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
