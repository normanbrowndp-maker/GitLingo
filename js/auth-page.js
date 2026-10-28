window.MEGA = window.MEGA || {};

(() => {
  const auth = window.MEGA.auth;
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
