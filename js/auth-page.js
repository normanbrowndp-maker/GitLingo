window.GitLingo = window.GitLingo || {};

(() => {
  const auth = window.GitLingo.auth;
  const initializingView = document.querySelector("[data-auth-initializing]");
  const unavailableView = document.querySelector("[data-auth-unavailable]");
  const guestView = document.querySelector("[data-auth-guest]");
  const accountView = document.querySelector("[data-auth-account]");
  const recoveryView = document.querySelector("[data-auth-recovery]");
  const signInForm = document.querySelector("#auth-sign-in-form");
  const signUpForm = document.querySelector("#auth-sign-up-form");
  const resetForm = document.querySelector("#auth-reset-request-form");
  const passwordUpdateForm = document.querySelector("#auth-password-update-form");
  const profilePanel = document.querySelector("[data-profile-panel]");
  const profileStatus = document.querySelector("[data-profile-status]");
  const profileName = document.querySelector("[data-profile-name]");
  const profileForm = document.querySelector("[data-profile-form]");
  const profileInput = document.querySelector("#profile-display-name");
  const profileNameError = document.querySelector("#profile-name-error");
  const profileEditButton = document.querySelector("[data-profile-edit]");
  const profileCancelButton = document.querySelector("[data-profile-cancel]");
  const profileRetryButton = document.querySelector("[data-profile-retry]");
  const cloudPanel = document.querySelector("[data-cloud-panel]");
  const cloudGuest = document.querySelector("[data-cloud-guest]");
  const cloudAccount = document.querySelector("[data-cloud-account]");
  const cloudStatus = document.querySelector("[data-cloud-status]");
  const cloudSummary = document.querySelector("[data-cloud-summary]");
  const cloudDate = document.querySelector("[data-cloud-date]");
  const cloudXp = document.querySelector("[data-cloud-xp]");
  const cloudLessons = document.querySelector("[data-cloud-lessons]");
  const cloudCheckButton = document.querySelector("[data-cloud-check]");
  const cloudSaveButton = document.querySelector("[data-cloud-save]");
  const cloudConfirm = document.querySelector("[data-cloud-confirm]");
  const cloudConfirmAccount = document.querySelector("[data-cloud-confirm-account]");
  const cloudConfirmLocal = document.querySelector("[data-cloud-confirm-local]");
  const cloudConfirmRemote = document.querySelector("[data-cloud-confirm-remote]");
  const cloudConfirmSaveButton = document.querySelector("[data-cloud-confirm-save]");
  const cloudCancelButton = document.querySelector("[data-cloud-cancel]");
  const views = [initializingView, unavailableView, guestView, accountView, recoveryView];
  let guestMessage = "";
  let guestMessageIsError = false;
  let accountMessage = "";
  let recoveryMessage = "";
  let currentMode = "sign-in";
  let profileOwnerId = null;
  let profileGeneration = 0;
  let savedDisplayName = null;
  let profileSaving = false;
  let cloudOwnerId = null;
  let cloudGeneration = 0;
  let cloudRequestId = 0;
  let cloudRow = null;
  let cloudRowState = null;
  let cloudRowKind = "unchecked";
  let cloudComparison = null;
  let cloudBusy = false;

  function setVisibleView(targetView) {
    for (const view of views) {
      if (view) view.hidden = view !== targetView;
    }
  }

  function setMessage(element, value, isError = false) {
    if (!element) return;
    element.textContent = value;
    if (isError) element.dataset.state = "error";
    else delete element.dataset.state;
  }

  function clearFieldError(input) {
    if (!input) return;
    const errorId = input.getAttribute("aria-describedby");
    const errorNode = errorId && document.getElementById(errorId);
    input.removeAttribute("aria-invalid");
    if (errorNode && errorNode.classList.contains("auth-field-error")) {
      errorNode.textContent = "";
      errorNode.hidden = true;
    }
  }

  function setFieldError(input, message) {
    if (!input) return;
    const errorId = input.getAttribute("aria-describedby");
    const errorNode = errorId && document.getElementById(errorId);
    input.setAttribute("aria-invalid", "true");
    if (errorNode) {
      errorNode.textContent = message;
      errorNode.hidden = false;
    }
    input.focus();
  }

  function clearFormErrors(form) {
    if (!form) return;
    for (const input of form.querySelectorAll("input")) clearFieldError(input);
  }

  function setMode(mode) {
    currentMode = mode;
    const modeButtons = document.querySelectorAll("[data-auth-mode]");
    for (const button of modeButtons) {
      const selected = button.dataset.authMode === mode;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
    }
    signInForm.hidden = mode !== "sign-in";
    signUpForm.hidden = mode !== "sign-up";
    resetForm.hidden = mode !== "reset";
  }

  function setProfileMessage(message, isError = false) {
    setMessage(profileStatus, message, isError);
  }

  function clearProfileFieldError() {
    profileInput.removeAttribute("aria-invalid");
    profileNameError.textContent = "";
    profileNameError.hidden = true;
  }

  function setProfileBusy(busy) {
    const submitButton = profileForm.querySelector("button[type=submit]");
    const cancelButton = profileCancelButton;
    if (submitButton) submitButton.disabled = busy;
    if (cancelButton) cancelButton.disabled = busy;
    profileForm.setAttribute("aria-busy", String(busy));
  }

  function clearProfileView() {
    savedDisplayName = null;
    profileSaving = false;
    profilePanel.hidden = true;
    profileName.hidden = true;
    profileName.textContent = "";
    profileInput.value = "";
    profileForm.hidden = true;
    profileEditButton.hidden = true;
    profileCancelButton.hidden = true;
    profileRetryButton.hidden = true;
    setProfileBusy(false);
    clearProfileFieldError();
    setProfileMessage("");
  }

  function cloudContextIsCurrent(userId, generation) {
    const current = auth.getState();
    return cloudOwnerId === userId && cloudGeneration === generation
      && current.ready && current.status === "authenticated" && !current.recovery
      && current.userId === userId;
  }

  function setCloudStatus(message, isError = false) {
    setMessage(cloudStatus, message, isError);
  }

  function clearCloudView() {
    cloudRequestId += 1;
    cloudRow = null;
    cloudRowState = null;
    cloudRowKind = "unchecked";
    cloudComparison = null;
    cloudBusy = false;
    cloudSummary.hidden = true;
    cloudConfirm.hidden = true;
    cloudCheckButton.disabled = false;
    cloudSaveButton.disabled = false;
    cloudConfirmSaveButton.disabled = false;
    cloudCancelButton.disabled = false;
    cloudAccount.removeAttribute("aria-busy");
    setCloudStatus("");
  }

  function renderCloudAccess(state) {
    const ready = Boolean(state && state.ready);
    const recovery = state && state.status === "authenticated" && state.recovery;
    cloudPanel.hidden = !ready || Boolean(recovery);
    const isAccount = ready && state.status === "authenticated" && !state.recovery;
    cloudGuest.hidden = isAccount;
    cloudAccount.hidden = !isAccount;
  }

  function setCloudBusy(busy) {
    cloudBusy = busy;
    cloudCheckButton.disabled = busy;
    cloudSaveButton.disabled = busy;
    cloudConfirmSaveButton.disabled = busy;
    cloudCancelButton.disabled = busy;
    cloudAccount.setAttribute("aria-busy", String(busy));
  }

  function validRevision(value) {
    return (Number.isSafeInteger(value) && value > 0)
      || (typeof value === "string" && /^[1-9][0-9]*$/.test(value));
  }

  function inspectCloudRow(row, userId) {
    if (!row || row.user_id !== userId || !validRevision(row.revision)
      || !Number.isInteger(row.schema_version) || typeof row.updated_at !== "string"
      || !Number.isFinite(Date.parse(row.updated_at))) return null;
    const inspected = window.GitLingo.state.inspectCloudSnapshot(row.state, row.schema_version);
    return inspected.ok ? { state: inspected.state, revision: row.revision } : null;
  }

  function progressSummary(state) {
    const completed = Object.values(state.lessons).filter((lesson) => lesson.completed).length;
    return `${state.xp} XP, завершено уроков: ${completed}`;
  }

  function renderCloudRow(userId) {
    if (cloudRowKind === "missing") {
      cloudSummary.hidden = true;
      setCloudStatus("Облачной копии пока нет.");
      return;
    }
    if (cloudRowKind === "unsupported") {
      cloudSummary.hidden = true;
      setCloudStatus("Неподдерживаемый формат облачной копии.", true);
      return;
    }
    if (cloudRowKind !== "found" || !cloudRow || !cloudRowState) {
      cloudSummary.hidden = true;
      return;
    }
    cloudSummary.hidden = false;
    cloudDate.textContent = new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cloudRow.updated_at));
    cloudXp.textContent = `${cloudRowState.xp} XP`;
    cloudLessons.textContent = `${Object.values(cloudRowState.lessons).filter((lesson) => lesson.completed).length}`;
    setCloudStatus("Облачная копия найдена.");
  }

  function cloudErrorMessage(reason) {
    if (reason === "network") return "Не удалось связаться с сервисом. Проверьте подключение и повторите проверку вручную.";
    if (reason === "not-authenticated" || reason === "stale-session") return "Сеанс аккаунта изменился. Откройте раздел снова.";
    if (reason === "busy") return "Сохранение уже выполняется. Подождите его завершения.";
    return "Не удалось проверить или сохранить копию. Проверьте подключение и доступ аккаунта.";
  }

  async function checkCloudCopy(userId, generation, options = {}) {
    if (!cloudContextIsCurrent(userId, generation) || cloudBusy) return false;
    const requestId = ++cloudRequestId;
    setCloudBusy(true);
    setCloudStatus("Проверяем облачную копию…");
    try {
      const result = await auth.getUserProgress();
      if (!cloudContextIsCurrent(userId, generation) || requestId !== cloudRequestId) return false;
      if (!result.ok) {
        cloudRowKind = "error";
        cloudRow = null;
        cloudRowState = null;
        cloudComparison = null;
        cloudSummary.hidden = true;
        cloudConfirm.hidden = true;
        setCloudStatus(cloudErrorMessage(result.reason), true);
        return false;
      }
      cloudRow = result.row;
      if (!cloudRow) {
        cloudRowKind = "missing";
        cloudRowState = null;
      } else {
        const inspected = inspectCloudRow(cloudRow, userId);
        cloudRowKind = inspected ? "found" : "unsupported";
        cloudRowState = inspected ? inspected.state : null;
      }
      renderCloudRow(userId);
      if (options.prepareConfirmation) return prepareCloudConfirmation(userId, generation);
      return true;
    } catch {
      if (cloudContextIsCurrent(userId, generation) && requestId === cloudRequestId) {
        cloudRowKind = "error";
        cloudComparison = null;
        cloudConfirm.hidden = true;
        setCloudStatus("Не удалось проверить облачную копию. Проверьте подключение и повторите попытку.", true);
      }
      return false;
    } finally {
      if (cloudContextIsCurrent(userId, generation) && requestId === cloudRequestId) setCloudBusy(false);
    }
  }

  function showCloudConfirmation(userId, snapshot) {
    cloudComparison = { userId, snapshot };
    cloudConfirmAccount.textContent = `Аккаунт: ${auth.getState().email || userId}`;
    cloudConfirmLocal.textContent = `Локальный снимок: ${progressSummary(snapshot.state)}.`;
    cloudConfirmRemote.textContent = cloudRowKind === "found"
      ? `Текущая облачная копия: ${progressSummary(cloudRowState)}.`
      : "Текущая облачная копия: отсутствует. Это будет первая запись общего прогресса браузера.";
    cloudConfirm.hidden = false;
  }

  async function prepareCloudConfirmation(userId, generation) {
    if (!cloudContextIsCurrent(userId, generation)) return false;
    if (cloudRowKind === "unsupported" || cloudRowKind === "error") return false;
    const local = window.GitLingo.state.getCloudSnapshot();
    if (!local.ok) {
      cloudComparison = null;
      cloudConfirm.hidden = true;
      setCloudStatus("Локальный прогресс недоступен или повреждён. Отправка запрещена.", true);
      return false;
    }
    showCloudConfirmation(userId, local);
    setCloudStatus("Сравнение готово. Подтвердите сохранение, чтобы отправить снимок.");
    return true;
  }

  async function startCloudSave(userId, generation) {
    if (cloudBusy || !cloudComparison || !cloudContextIsCurrent(userId, generation)) return;
    setCloudBusy(true);
    const currentLocal = window.GitLingo.state.getCloudSnapshot();
    if (!currentLocal.ok) {
      cloudConfirm.hidden = true;
      cloudComparison = null;
      setCloudBusy(false);
      setCloudStatus("Локальный прогресс недоступен или повреждён. Отправка запрещена.", true);
      return;
    }
    if (currentLocal.fingerprint !== cloudComparison.snapshot.fingerprint) {
      showCloudConfirmation(userId, currentLocal);
      setCloudBusy(false);
      setCloudStatus("Локальный прогресс изменился. Сверьте обновлённое сравнение и подтвердите заново.");
      return;
    }

    const comparison = cloudComparison;
    const expectedRevision = cloudRowKind === "found" ? cloudRow.revision : null;
    setCloudStatus("Сохраняем копию…");
    try {
      const result = await auth.saveUserProgress(comparison.snapshot.state, comparison.snapshot.schemaVersion, expectedRevision, comparison.snapshot.fingerprint);
      if (!cloudContextIsCurrent(userId, generation)) return;
      if (result.ok) {
        cloudRow = result.row;
        const inspected = inspectCloudRow(cloudRow, userId);
        cloudRowKind = inspected ? "found" : "unsupported";
        cloudRowState = inspected ? inspected.state : null;
        cloudComparison = null;
        cloudConfirm.hidden = true;
        renderCloudRow(userId);
        const latestLocal = window.GitLingo.state.getCloudSnapshot();
        setCloudStatus(latestLocal.ok && latestLocal.fingerprint !== comparison.snapshot.fingerprint
          ? "Копия сохранена, но есть более новые локальные изменения."
          : "Копия сохранена на сервере.");
        return;
      }
      if (result.reason === "conflict" || result.reason === "primary-conflict") {
        cloudComparison = null;
        cloudConfirm.hidden = true;
        setCloudStatus("Облачная копия изменилась в другом окне. Загружаем новое сравнение…");
        setCloudBusy(false);
        await checkCloudCopy(userId, generation, { prepareConfirmation: true });
        if (cloudContextIsCurrent(userId, generation) && cloudComparison) {
          setCloudStatus("Сверьте новое сравнение и подтвердите сохранение ещё раз.");
        }
        return;
      }
      if (result.reason === "local-changed") {
        const latestLocal = window.GitLingo.state.getCloudSnapshot();
        if (latestLocal.ok) showCloudConfirmation(userId, latestLocal);
        else {
          cloudComparison = null;
          cloudConfirm.hidden = true;
        }
        setCloudStatus(latestLocal.ok
          ? "Локальный прогресс изменился. Сверьте обновлённое сравнение и подтвердите заново."
          : "Локальный прогресс недоступен или повреждён. Отправка запрещена.", !latestLocal.ok);
        return;
      }
      setCloudStatus(result.reason === "invalid-local-state"
        ? "Локальный прогресс недоступен или повреждён. Отправка запрещена."
        : cloudErrorMessage(result.reason), true);
    } catch {
      if (cloudContextIsCurrent(userId, generation)) setCloudStatus("Не удалось сохранить копию. Проверьте подключение; серверный результат неизвестен.", true);
    } finally {
      if (cloudContextIsCurrent(userId, generation)) setCloudBusy(false);
    }
  }

  function initializeCloudForUser(userId, generation) {
    if (!userId || !cloudContextIsCurrent(userId, generation)) return;
    setCloudStatus("Проверяем облачную копию…");
    window.setTimeout(() => checkCloudCopy(userId, generation), 0);
  }

  function profileContextIsCurrent(userId, generation) {
    const current = auth.getState();
    return profileGeneration === generation
      && profileOwnerId === userId
      && current.ready
      && current.status === "authenticated"
      && !current.recovery
      && current.userId === userId;
  }

  function renderLoadedProfile(profile, options = {}) {
    savedDisplayName = profile ? profile.display_name : null;
    profilePanel.hidden = false;
    profileRetryButton.hidden = true;
    if (savedDisplayName === null) {
      profileName.hidden = true;
      profileName.textContent = "";
      profileForm.hidden = false;
      profileEditButton.hidden = true;
      profileCancelButton.hidden = true;
      if (!options.preserveDraft) profileInput.value = "";
      setProfileMessage("Профиль ещё не создан. Введи имя, которое будет видно в аккаунте.");
      return;
    }

    profileName.textContent = `Имя: ${savedDisplayName}`;
    profileName.hidden = false;
    if (options.preserveDraft && options.draft !== savedDisplayName) {
      profileInput.value = options.draft;
      profileForm.hidden = false;
      profileEditButton.hidden = true;
      profileCancelButton.hidden = false;
      setProfileMessage("Профиль загружен. Чтобы сохранить введённый вариант, нажми «Сохранить» ещё раз.");
    } else {
      profileInput.value = savedDisplayName;
      profileForm.hidden = true;
      profileEditButton.hidden = false;
      profileCancelButton.hidden = true;
      setProfileMessage("");
    }
  }

  async function loadProfile(userId, generation, options = {}) {
    if (!profileContextIsCurrent(userId, generation)) return;
    const draft = profileInput.value;
    const result = await auth.getProfile();
    if (!profileContextIsCurrent(userId, generation)) return;
    if (result.ok) {
      renderLoadedProfile(result.profile, { preserveDraft: options.preserveDraft, draft });
      return;
    }

    profilePanel.hidden = false;
    profileName.hidden = true;
    profileForm.hidden = true;
    profileRetryButton.hidden = false;
    setProfileMessage(profileErrorMessage(result.reason, "load"), true);
  }

  function profileErrorMessage(reason, operation) {
    if (reason === "invalid-name") return "Введи имя длиной от 1 до 40 символов.";
    if (reason === "profile-conflict") return "Профиль уже создан в другой вкладке. Сверь введённое имя с сохранённым и нажми «Сохранить» ещё раз.";
    if (reason === "profile-not-updated") return "Профиль не был обновлён. Перезагрузи его и повтори попытку.";
    if (reason === "network") return "Не удалось связаться с сервисом. Проверь подключение и попробуй ещё раз.";
    if (reason === "not-authenticated" || reason === "stale-session") return "Сеанс аккаунта изменился. Открой профиль снова.";
    if (operation === "load") return "Не удалось загрузить профиль. Попробуй ещё раз.";
    return "Не удалось сохранить имя. Проверь введённое значение и попробуй ещё раз.";
  }

  function onAuthState(state) {
    render(state);
    renderCloudAccess(state);
    const cloudUserId = state && state.ready && state.status === "authenticated" && !state.recovery
      ? state.userId
      : "";
    if (cloudUserId !== cloudOwnerId) {
      cloudGeneration += 1;
      cloudOwnerId = cloudUserId || null;
      clearCloudView();
      if (cloudUserId) initializeCloudForUser(cloudUserId, cloudGeneration);
    }
    const userId = state && state.ready && state.status === "authenticated" && !state.recovery
      ? state.userId
      : "";
    if (userId === profileOwnerId) return;

    profileGeneration += 1;
    const generation = profileGeneration;
    profileOwnerId = userId;
    clearProfileView();
    if (!userId) return;

    profilePanel.hidden = false;
    setProfileMessage("Загружаем профиль…");
    window.setTimeout(() => loadProfile(userId, generation), 0);
  }

  function retryProfileLoad() {
    const userId = profileOwnerId;
    if (!userId) return;
    const draft = profileInput.value;
    profileGeneration += 1;
    const generation = profileGeneration;
    profilePanel.hidden = false;
    profileName.hidden = true;
    profileForm.hidden = true;
    profileRetryButton.hidden = true;
    setProfileMessage("Загружаем профиль…");
    profileInput.value = draft;
    window.setTimeout(() => loadProfile(userId, generation, { preserveDraft: true }), 0);
  }

  function displayNameValidation(value) {
    const displayName = value.replace(/^ +| +$/g, "");
    const length = Array.from(displayName).length;
    if (length < 1) return { ok: false, message: "Введи имя. Одни пробелы не подходят." };
    if (length > 40) return { ok: false, message: "Имя должно содержать не больше 40 символов." };
    return { ok: true, displayName };
  }

  function availabilityMessage(reason) {
    if (reason === "local-server-required") return "Для авторизации откройте GitLingo через localhost. Гостевой режим работает и через file://.";
    if (reason === "unconfigured") return "Подключение аккаунтов ещё не настроено. Гостевой режим доступен.";
    if (reason === "invalid-config") return "Параметры Supabase не заполнены или имеют неверный формат. Проверьте локальный файл js/supabase-config.js.";
    if (reason === "sdk-missing") return "Локальная библиотека авторизации не загрузилась. Проверьте файлы проекта.";
    return "Не удалось подготовить авторизацию. Проверьте настройки Supabase и перезагрузите страницу.";
  }

  function render(state) {
    if (!state || !state.ready) {
      setVisibleView(initializingView);
      return;
    }

    const availability = auth.getAvailability();
    if (availability !== "available") {
      setVisibleView(unavailableView);
      setMessage(document.querySelector("#auth-unavailable-message"), availabilityMessage(availability));
      return;
    }

    if (state.status === "authenticated" && state.recovery) {
      setVisibleView(recoveryView);
      setMessage(document.querySelector("[data-auth-recovery-message]"), recoveryMessage);
      return;
    }

    if (state.status === "authenticated") {
      setVisibleView(accountView);
      document.querySelector("[data-auth-email]").textContent = state.email || "Email не указан";
      const callbackMessage = state.callback === "password-updated"
        ? "Пароль обновлён. Вы остались в аккаунте."
        : state.callback === "expired"
          ? "Ссылка устарела или уже использована. Можно запросить новую."
          : state.callback === "invalid"
            ? "Не удалось обработать ссылку. Если это была ссылка восстановления, запросите новую."
            : state.callback === "confirmed"
              ? "Email подтверждён. Выполнен вход."
              : accountMessage;
      setMessage(document.querySelector("[data-auth-account-message]"), callbackMessage);
      return;
    }

    setVisibleView(guestView);
    const callbackMessage = state.callback === "confirmed"
      ? "Email подтверждён. Теперь войдите в аккаунт."
      : state.callback === "expired"
        ? "Ссылка устарела или уже использована. Запросите новое письмо."
        : state.callback === "invalid"
          ? "Ссылка недействительна или её не удалось обработать. Запросите новое письмо и откройте его в этом же браузере."
          : guestMessage;
    setMessage(document.querySelector("#auth-message"), callbackMessage, state.callback === "expired" || state.callback === "invalid" || guestMessageIsError);
    setMode(currentMode);
  }

  function errorMessage(reason, operation) {
    if (reason === "busy") return "Запрос уже выполняется. Подождите его завершения.";
    if (reason === "rate-limit") return "Слишком много запросов. Подождите перед следующей попыткой.";
    if (reason === "network") return "Не удалось связаться с сервисом. Проверьте подключение и попробуйте позже.";
    if (reason === "email-not-confirmed") return "Подтвердите email по ссылке из письма, затем войдите.";
    if (reason === "invalid-credentials") return "Не удалось войти. Проверьте email и пароль.";
    if (reason === "password-policy") return "Пароль не соответствует требованиям проекта Supabase.";
    if (reason === "expired-link") return "Ссылка устарела или уже использована. Запросите новое письмо.";
    if (reason === "invalid-link" || reason === "recovery-required") return "Сначала откройте действующую ссылку восстановления в этом же браузере.";
    if (operation === "reset") return "Не удалось отправить запрос. Если адрес зарегистрирован, письмо можно запросить позже.";
    if (operation === "sign-up") return "Не удалось создать аккаунт. Проверьте введённые данные и попробуйте позже.";
    if (operation === "update-password") return "Не удалось сменить пароль. Проверьте требования Supabase или запросите новую ссылку.";
    if (operation === "sign-out") return "Не удалось завершить сеанс. Повторите попытку.";
    return "Не удалось выполнить запрос. Попробуйте позже.";
  }

  function clearGuestMessage() {
    guestMessage = "";
    guestMessageIsError = false;
    setMessage(document.querySelector("#auth-message"), "");
  }

  function setFormBusy(form, busy) {
    const submitButton = form.querySelector("button[type=submit]");
    if (submitButton) submitButton.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
  }

  function emailFrom(form) {
    return String(new FormData(form).get("email") || "").trim();
  }

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      clearGuestMessage();
      setMode(button.dataset.authMode);
    });
  });

  document.querySelector("[data-auth-forgot]").addEventListener("click", () => {
    clearGuestMessage();
    currentMode = "reset";
    setMode(currentMode);
    document.querySelector("#auth-reset-email").focus();
  });

  document.querySelector("[data-auth-back-to-sign-in]").addEventListener("click", () => {
    clearGuestMessage();
    setMode("sign-in");
    document.querySelector("#auth-sign-in-email").focus();
  });

  document.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      button.setAttribute("aria-pressed", String(showPassword));
      button.setAttribute("aria-label", showPassword ? "Скрыть пароль" : "Показать пароль");
      const use = button.querySelector("use");
      if (use) use.setAttribute("href", showPassword ? "#icon-eye-off" : "#icon-eye");
    });
  });

  profileEditButton.addEventListener("click", () => {
    if (savedDisplayName === null) return;
    clearProfileFieldError();
    profileInput.value = savedDisplayName;
    profileName.hidden = true;
    profileForm.hidden = false;
    profileEditButton.hidden = true;
    profileCancelButton.hidden = false;
    setProfileMessage("");
    profileInput.focus();
  });

  profileCancelButton.addEventListener("click", () => {
    if (savedDisplayName === null || profileSaving) return;
    profileInput.value = savedDisplayName;
    clearProfileFieldError();
    profileForm.hidden = true;
    profileName.hidden = false;
    profileEditButton.hidden = false;
    profileCancelButton.hidden = true;
    setProfileMessage("");
  });

  profileRetryButton.addEventListener("click", retryProfileLoad);

  cloudCheckButton.addEventListener("click", () => {
    const userId = cloudOwnerId;
    if (userId) checkCloudCopy(userId, cloudGeneration);
  });

  cloudSaveButton.addEventListener("click", () => {
    const userId = cloudOwnerId;
    if (userId) checkCloudCopy(userId, cloudGeneration, { prepareConfirmation: true });
  });

  cloudConfirmSaveButton.addEventListener("click", () => {
    const userId = cloudOwnerId;
    if (userId) startCloudSave(userId, cloudGeneration);
  });

  cloudCancelButton.addEventListener("click", () => {
    if (cloudBusy) return;
    cloudComparison = null;
    cloudConfirm.hidden = true;
    setCloudStatus("Сохранение отменено.");
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (profileSaving) return;
    const userId = profileOwnerId;
    const generation = profileGeneration;
    if (!userId || !profileContextIsCurrent(userId, generation)) return;

    clearProfileFieldError();
    const validation = displayNameValidation(profileInput.value);
    if (!validation.ok) {
      profileInput.setAttribute("aria-invalid", "true");
      profileNameError.textContent = validation.message;
      profileNameError.hidden = false;
      profileInput.focus();
      return;
    }

    profileSaving = true;
    setProfileBusy(true);
    setProfileMessage("Сохраняем имя…");
    try {
      const result = savedDisplayName === null
        ? await auth.createProfile(validation.displayName)
        : await auth.updateProfile(validation.displayName);
      if (!profileContextIsCurrent(userId, generation)) return;

      if (result.ok) {
        renderLoadedProfile(result.profile);
        setProfileMessage("Имя сохранено.");
        return;
      }

      if (result.reason === "profile-conflict" && result.profile) {
        savedDisplayName = result.profile.display_name;
        profileName.textContent = `Сохранённое имя: ${savedDisplayName}`;
        profileName.hidden = false;
        profileForm.hidden = false;
        profileEditButton.hidden = true;
        profileCancelButton.hidden = false;
      }
      setProfileMessage(profileErrorMessage(result.reason, "save"), true);
    } finally {
      if (profileContextIsCurrent(userId, generation)) {
        profileSaving = false;
        setProfileBusy(false);
      }
    }
  });

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearGuestMessage();
    clearFormErrors(signInForm);
    if (!signInForm.reportValidity()) return;
    const email = emailFrom(signInForm);
    const password = document.querySelector("#auth-sign-in-password").value;
    setFormBusy(signInForm, true);
    const result = await auth.signIn(email, password);
    setFormBusy(signInForm, false);
    if (result.ok) {
      accountMessage = "Вход выполнен.";
      guestMessage = "";
      render(auth.getState());
      return;
    }
    guestMessage = errorMessage(result.reason, "sign-in");
    guestMessageIsError = true;
    render(auth.getState());
  });

  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearGuestMessage();
    clearFormErrors(signUpForm);
    if (!signUpForm.reportValidity()) return;
    const passwordInput = document.querySelector("#auth-sign-up-password");
    const confirmInput = document.querySelector("#auth-sign-up-confirm");
    if (passwordInput.value !== confirmInput.value) {
      setFieldError(confirmInput, "Пароли не совпадают.");
      return;
    }
    setFormBusy(signUpForm, true);
    const result = await auth.signUp(emailFrom(signUpForm), passwordInput.value);
    setFormBusy(signUpForm, false);
    if (result.ok) {
      if (result.confirmationRequired) {
        guestMessage = "Если адрес можно зарегистрировать, на него отправлено письмо. Проверьте почту и подтвердите email перед входом. Доставка может занять некоторое время.";
      } else {
        guestMessage = "Аккаунт создан. Состояние входа обновится после ответа сервиса.";
      }
      guestMessageIsError = false;
      render(auth.getState());
      return;
    }
    if (result.reason === "password-policy") setFieldError(passwordInput, errorMessage(result.reason, "sign-up"));
    else {
      guestMessage = errorMessage(result.reason, "sign-up");
      guestMessageIsError = true;
      render(auth.getState());
    }
  });

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearGuestMessage();
    clearFormErrors(resetForm);
    if (!resetForm.reportValidity()) return;
    setFormBusy(resetForm, true);
    const result = await auth.requestPasswordReset(emailFrom(resetForm));
    setFormBusy(resetForm, false);
    guestMessage = result.ok
      ? "Если адрес зарегистрирован, письмо со ссылкой будет отправлено. Доставка может занять некоторое время."
      : errorMessage(result.reason, "reset");
    guestMessageIsError = !result.ok;
    render(auth.getState());
  });

  passwordUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    recoveryMessage = "";
    clearFormErrors(passwordUpdateForm);
    if (!passwordUpdateForm.reportValidity()) return;
    const passwordInput = document.querySelector("#auth-new-password");
    const confirmInput = document.querySelector("#auth-new-password-confirm");
    if (passwordInput.value !== confirmInput.value) {
      setFieldError(confirmInput, "Пароли не совпадают.");
      return;
    }
    setFormBusy(passwordUpdateForm, true);
    const result = await auth.updatePassword(passwordInput.value);
    setFormBusy(passwordUpdateForm, false);
    if (result.ok) {
      accountMessage = "Пароль обновлён. Вы остались в аккаунте.";
      render(auth.getState());
      return;
    }
    if (result.reason === "password-policy") setFieldError(passwordInput, errorMessage(result.reason, "update-password"));
    else {
      recoveryMessage = errorMessage(result.reason, "update-password");
      render(auth.getState());
    }
  });

  document.querySelector("[data-auth-sign-out]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    profileGeneration += 1;
    profileOwnerId = null;
    clearProfileView();
    button.disabled = true;
    const result = await auth.signOut();
    button.disabled = false;
    if (result.ok) {
      guestMessage = "Вы вышли из аккаунта.";
      guestMessageIsError = false;
    } else {
      accountMessage = errorMessage(result.reason, "sign-out");
      onAuthState(auth.getState());
    }
  });

  window.addEventListener("mega-auth-state", (event) => onAuthState(event.detail));
  onAuthState(auth.getState());
})();
