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
  const views = [initializingView, unavailableView, guestView, accountView, recoveryView];
  let guestMessage = "";
  let guestMessageIsError = false;
  let accountMessage = "";
  let recoveryMessage = "";
  let currentMode = "sign-in";

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
    button.disabled = true;
    const result = await auth.signOut();
    button.disabled = false;
    if (result.ok) {
      guestMessage = "Вы вышли из аккаунта.";
      guestMessageIsError = false;
    } else {
      accountMessage = errorMessage(result.reason, "sign-out");
      render(auth.getState());
    }
  });

  window.addEventListener("mega-auth-state", (event) => render(event.detail));
  render(auth.getState());
})();
