window.GitLingo = window.GitLingo || {};

(() => {
  const key = "mega-state";
  const backupKey = "mega-state-backup-v1";
  const exportVersion = 1;
  const lessonIds = [1, 2, 3, 4, 5];
  const bonusIds = ["b1", "b2"];
  const courseUnitId = "terminal-paths-v1";
  const courseNodeIds = ["course-terminal-study", "course-terminal-practice", "course-terminal-check"];
  const profileLevels = ["Ничего", "Немного", "Уверенно"];

  function createDefaultState() {
    return {
      v: 1,
      xp: 0,
      streak: 0,
      hearts: 5,
      lastActiveDate: null,
      profile: { level: null },
      mistakes: [],
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
    if (!Object.prototype.hasOwnProperty.call(value, "hearts")) {
      result.hearts = defaults.hearts;
      changed = true;
    } else if (!Number.isInteger(value.hearts) || value.hearts < 0 || value.hearts > 5) {
      return { error: "invalid-structure" };
    }
    if (!Object.prototype.hasOwnProperty.call(value, "mistakes")) {
      result.mistakes = [];
      changed = true;
    } else if (!Array.isArray(value.mistakes)) {
      return { error: "invalid-structure" };
    } else {
      result.mistakes = value.mistakes.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)
          || typeof entry.id !== "string" || entry.id.length < 1 || entry.id.length > 160
          || !["lesson", "bonus", "course"].includes(entry.unitKind)
          || typeof entry.unitId !== "string" || entry.unitId.length < 1 || entry.unitId.length > 24
          || !["practice", "test"].includes(entry.phase)
          || (entry.unitKind === "lesson" && !lessonIds.map(String).includes(entry.unitId))
          || (entry.unitKind === "bonus" && (!bonusIds.includes(entry.unitId) || entry.phase !== "practice"))
          || (entry.unitKind === "course" && entry.unitId !== courseUnitId)
          || !Number.isInteger(entry.taskIndex) || entry.taskIndex < 0 || entry.taskIndex > 200
          || !["choice", "builder", "hotkeys", "matching", "output-reading"].includes(entry.type)
          || !Number.isInteger(entry.wrongCount) || entry.wrongCount < 1
          || typeof entry.needsReview !== "boolean"
          || !Number.isInteger(entry.reviewVersion) || entry.reviewVersion < 1) return null;

        const answer = entry.answer;
        if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
        if (["choice", "hotkeys", "output-reading"].includes(entry.type)) {
          if (answer.kind !== "option" || typeof answer.selected !== "string" || answer.selected.length > 80) return null;
        } else if (entry.type === "builder") {
          if (answer.kind !== "builder" || !Array.isArray(answer.blocks) || answer.blocks.length > 40
            || answer.blocks.some((block) => typeof block !== "string" || block.length > 160)) return null;
        } else if (answer.kind !== "matching" || !Array.isArray(answer.pairs) || answer.pairs.length > 40
          || answer.pairs.some((pair) => !pair || !Number.isInteger(pair.termIndex) || pair.termIndex < 0
            || !Number.isInteger(pair.definitionIndex) || pair.definitionIndex < 0)) return null;

        return {
          id: entry.id,
          unitKind: entry.unitKind,
          unitId: entry.unitId,
          phase: entry.phase,
          taskIndex: entry.taskIndex,
          type: entry.type,
          answer: clone(answer),
          wrongCount: entry.wrongCount,
          needsReview: entry.needsReview,
          reviewVersion: entry.reviewVersion
        };
      });
      if (result.mistakes.some((entry) => entry === null)) return { error: "invalid-structure" };
      const ids = result.mistakes.map((entry) => entry.id);
      if (new Set(ids).size !== ids.length) return { error: "invalid-structure" };
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

    if (Object.prototype.hasOwnProperty.call(value, "courseProgress")) {
      if (!value.courseProgress || typeof value.courseProgress !== "object" || Array.isArray(value.courseProgress)) return { error: "invalid-structure" };
      result.courseProgress = { ...value.courseProgress };
      for (const nodeId of courseNodeIds) {
        if (Object.prototype.hasOwnProperty.call(result.courseProgress, nodeId)
          && typeof result.courseProgress[nodeId] !== "boolean") return { error: "invalid-structure" };
        if (!Object.prototype.hasOwnProperty.call(result.courseProgress, nodeId)) result.courseProgress[nodeId] = false;
      }
      if (Object.keys(result.courseProgress).some((nodeId) => !courseNodeIds.includes(nodeId))) return { error: "invalid-structure" };
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
      if (window.GitLingo.deferStorageMigration === true) return;
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

  function refreshState() {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      markProtected("storage-unavailable", null, error && error.name === "SecurityError" ? "access-denied" : "read-failed");
      return { ok: false };
    }
    if (raw === null) {
      if (status.kind !== "missing" && status.hasSavedState) {
        markProtected("storage-unavailable", null, "saved-state-removed");
        return { ok: false };
      }
      state = createDefaultState();
      status = makeStatus("missing", { hasSavedState: false });
      return { ok: true, state: getState() };
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      markProtected("corrupt-json", raw, "syntax-error");
      return { ok: false };
    }
    const checked = validateAndMigrate(parsed);
    if (checked.error) {
      markProtected(checked.error, raw);
      return { ok: false };
    }
    if (checked.changed) {
      state = checked.state;
      markProtected("migration-write-failed", raw, "refresh-migration-required");
      return { ok: false };
    }
    state = checked.state;
    status = makeStatus("ok", { hasSavedState: true });
    return { ok: true, state: getState() };
  }

  function getCloudSnapshot() {
    if (!['ok', 'missing', 'migration-pending'].includes(status.kind) || status.lastWriteError) {
      return { ok: false, reason: 'local-state-unavailable' };
    }

    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return { ok: false, reason: 'local-state-unavailable' };
    }

    let candidate;
    if (raw === null) {
      if (status.kind !== 'missing') return { ok: false, reason: 'local-state-unavailable' };
      candidate = createDefaultState();
    } else {
      try {
        candidate = JSON.parse(raw);
      } catch {
        return { ok: false, reason: 'local-state-unavailable' };
      }
    }

    const checked = validateAndMigrate(candidate);
    if (checked.error || (checked.changed && status.kind !== 'migration-pending')) return { ok: false, reason: 'local-state-unavailable' };
    const snapshot = clone(checked.state);
    return { ok: true, state: snapshot, fingerprint: JSON.stringify(snapshot), schemaVersion: snapshot.v };
  }

  function inspectCloudSnapshot(value, schemaVersion) {
    if (!Number.isInteger(schemaVersion) || schemaVersion !== 1) return { ok: false };
    const checked = validateAndMigrate(value);
    const isOlderFullSnapshot = value && typeof value === "object" && !Array.isArray(value)
      && value.v === schemaVersion
      && (!Object.prototype.hasOwnProperty.call(value, "hearts") || !Object.prototype.hasOwnProperty.call(value, "mistakes"));
    if (checked.error || (checked.changed && !isOlderFullSnapshot) || checked.state.v !== schemaVersion) return { ok: false };
    return { ok: true, state: clone(checked.state) };
  }

  function questionId(unitKind, unitId, phase, taskIndex, task) {
    if (!["lesson", "bonus", "course"].includes(unitKind) || typeof unitId !== "string"
      || !["practice", "test"].includes(phase) || !Number.isInteger(taskIndex) || taskIndex < 0
      || !task || typeof task.type !== "string" || typeof task.question !== "string") return "";
    if (unitKind === "course" && (unitId !== courseUnitId || typeof task.id !== "string")) return "";
    const options = Array.isArray(task.options) ? task.options.map((option) => {
      const optionShape = {
        id: option.id,
        text: option.text || "",
        code: option.code || "",
        keys: Array.isArray(option.keys) ? option.keys : []
      };
      if (unitKind === "course") optionShape.records = Array.isArray(option.records) ? option.records : [];
      return optionShape;
    }) : [];
    const taskShape = {
      type: task.type,
      question: task.question,
      answer: task.answer,
      options,
      blocks: Array.isArray(task.blocks) ? task.blocks : [],
      pairs: Array.isArray(task.pairs) ? task.pairs.map((pair) => [pair.term, pair.def]) : []
    };
    if (unitKind === "course") Object.assign(taskShape, {
      environment: task.environment || "",
      command: task.command || "",
      output: task.output || "",
      records: Array.isArray(task.records) ? task.records : []
    });
    const shape = JSON.stringify(taskShape);
    let first = 2166136261;
    let second = 0x9e3779b9;
    for (let index = 0; index < shape.length; index += 1) {
      const code = shape.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 2246822519);
    }
    const fingerprint = `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
    return unitKind === "course"
      ? `${unitKind}:${unitId}:${phase}:${task.id}:${fingerprint}`
      : `${unitKind}:${unitId}:${phase}:${taskIndex}:${fingerprint}`;
  }

  function normalizeMistakeAnswer(type, answer) {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
    if (["choice", "hotkeys", "output-reading"].includes(type) && answer.kind === "option"
      && typeof answer.selected === "string" && answer.selected.length <= 80) {
      return { kind: "option", selected: answer.selected };
    }
    if (type === "builder" && answer.kind === "builder" && Array.isArray(answer.blocks)
      && answer.blocks.length <= 40 && answer.blocks.every((block) => typeof block === "string" && block.length <= 160)) {
      return { kind: "builder", blocks: answer.blocks.slice() };
    }
    if (type === "matching" && answer.kind === "matching" && Array.isArray(answer.pairs)
      && answer.pairs.length <= 40 && answer.pairs.every((pair) => pair
        && Number.isInteger(pair.termIndex) && pair.termIndex >= 0
        && Number.isInteger(pair.definitionIndex) && pair.definitionIndex >= 0)) {
      return { kind: "matching", pairs: answer.pairs.map((pair) => ({
        termIndex: pair.termIndex,
        definitionIndex: pair.definitionIndex
      })) };
    }
    return null;
  }

  function refreshStateBeforeReviewWrite() {
    if (!status.writable) return false;
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return false;
    }
    if (raw === null) {
      if (status.kind !== "missing" || status.hasSavedState) return false;
      state = createDefaultState();
      return true;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
    const checked = validateAndMigrate(parsed);
    if (checked.error || checked.changed) return false;
    state = checked.state;
    status = makeStatus("ok", { hasSavedState: true });
    return true;
  }

  function recordQuestionError(info, answer, loseHeart = false, expectedReviewVersion = null) {
    if (!info || typeof info.id !== "string" || !info.id || info.id.length > 160
      || !["lesson", "bonus", "course"].includes(info.unitKind) || typeof info.unitId !== "string"
      || !["practice", "test"].includes(info.phase) || !Number.isInteger(info.taskIndex) || info.taskIndex < 0
      || (info.unitKind === "lesson" && !lessonIds.map(String).includes(info.unitId))
      || (info.unitKind === "bonus" && (!bonusIds.includes(info.unitId) || info.phase !== "practice"))
      || (info.unitKind === "course" && info.unitId !== courseUnitId)
      || !["choice", "builder", "hotkeys", "matching", "output-reading"].includes(info.type)) return { ok: false, reason: "invalid-record" };
    const safeAnswer = normalizeMistakeAnswer(info.type, answer);
    if (!safeAnswer) return { ok: false, reason: "invalid-answer" };
    if (!refreshStateBeforeReviewWrite()) return { ok: false, saved: false, stale: false, reason: "state-unavailable", hearts: state.hearts };
    const next = clone(state);
    const existingIndex = next.mistakes.findIndex((entry) => entry.id === info.id);
    if (expectedReviewVersion !== null) {
      const existing = next.mistakes[existingIndex];
      if (!existing || !existing.needsReview || existing.reviewVersion !== expectedReviewVersion) {
        return { ok: true, saved: false, stale: true, hearts: state.hearts };
      }
    }
    if (existingIndex >= 0) {
      const existing = next.mistakes[existingIndex];
      existing.wrongCount += 1;
      existing.answer = safeAnswer;
      if (!existing.needsReview) {
        existing.needsReview = true;
        existing.reviewVersion += 1;
      }
    } else {
      next.mistakes.push({
        id: info.id,
        unitKind: info.unitKind,
        unitId: info.unitId,
        phase: info.phase,
        taskIndex: info.taskIndex,
        type: info.type,
        answer: safeAnswer,
        wrongCount: 1,
        needsReview: true,
        reviewVersion: 1
      });
    }
    if (loseHeart) next.hearts = Math.max(0, next.hearts - 1);
    const result = persist(next);
    return result.ok
      ? { ok: true, saved: true, stale: false, hearts: state.hearts }
      : { ok: false, saved: false, stale: false, reason: result.error, hearts: state.hearts };
  }

  function resolveReviewQuestion(id, reviewVersion) {
    if (!refreshStateBeforeReviewWrite()) return { ok: false, closed: false, hearts: state.hearts, reason: "state-unavailable" };
    const next = clone(state);
    const entry = next.mistakes.find((mistake) => mistake.id === id);
    if (!entry || !entry.needsReview || entry.reviewVersion !== reviewVersion) {
      return { ok: true, closed: false, hearts: state.hearts, heartsAwarded: 0 };
    }
    const heartsBefore = state.hearts;
    entry.needsReview = false;
    next.hearts = Math.min(5, next.hearts + 1);
    const result = persist(next);
    return result.ok
      ? { ok: true, closed: true, hearts: state.hearts, heartsAwarded: state.hearts - heartsBefore }
      : { ok: false, closed: false, hearts: state.hearts, heartsAwarded: 0, reason: result.error };
  }

  function removeMistake(id) {
    if (!refreshStateBeforeReviewWrite()) return { ok: false, removed: false, reason: "state-unavailable" };
    const next = clone(state);
    const index = next.mistakes.findIndex((entry) => entry.id === id);
    if (index < 0) return { ok: true, removed: false };
    next.mistakes.splice(index, 1);
    const result = persist(next);
    return result.ok ? { ok: true, removed: true } : { ok: false, removed: false, reason: result.error };
  }

  function restoreHearts() {
    if (!refreshStateBeforeReviewWrite()) return { ok: false, hearts: state.hearts, reason: "state-unavailable" };
    if (state.hearts === 5) return { ok: true, hearts: 5, changed: false };
    const next = clone(state);
    next.hearts = 5;
    const result = persist(next);
    return result.ok ? { ok: true, hearts: state.hearts, changed: true } : { ok: false, hearts: state.hearts, reason: result.error };
  }

  function saveState(options = {}) {
    const result = persist(state, { allowProtected: options.allowProtected === true });
    return result.ok ? getState() : false;
  }

  loadState();

  window.GitLingo.state = {
    get: getState,
    refresh: refreshState,
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
    getCloudSnapshot,
    inspectCloudSnapshot,
    questionId,
    recordQuestionError,
    resolveReviewQuestion,
    removeMistake,
    restoreHearts,
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
    getCourseProgress() {
      return clone(state.courseProgress || {});
    },
    completeCourseNode(nodeId, xpAward = 0) {
      if (!courseNodeIds.includes(nodeId) || !status.writable || !refreshStateBeforeReviewWrite()) return { ok: false, completed: false, firstCompletion: false };
      const next = clone(state);
      next.courseProgress = { ...(next.courseProgress || {}) };
      const wasComplete = next.courseProgress[nodeId] === true;
      next.courseProgress[nodeId] = true;
      const firstCompletion = !wasComplete;
      const award = firstCompletion && Number.isFinite(xpAward) ? Math.max(0, Math.floor(xpAward)) : 0;
      next.xp += award;
      const result = persist(next);
      return result.ok
        ? { ok: true, completed: true, firstCompletion, xpAwarded: award }
        : { ok: false, completed: false, firstCompletion: false, error: result.error };
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
