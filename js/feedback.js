window.GitLingo = window.GitLingo || {};

(() => {
  const auth = window.GitLingo.auth;
  const views = {
    loading: document.querySelector("[data-feedback-loading]"),
    guest: document.querySelector("[data-feedback-guest]"),
    authError: document.querySelector("[data-feedback-auth-error]"),
    form: document.querySelector("[data-feedback-form]"),
    success: document.querySelector("[data-feedback-success]")
  };
  const form = document.querySelector("#feedback-form");
  const starButtons = [...document.querySelectorAll("#feedback-stars [data-rating]")];
  const starsLive = document.querySelector("#feedback-stars-live");
  const ratingError = document.querySelector("#feedback-rating-error");
  const commentInput = document.querySelector("#feedback-comment");
  const commentUsed = document.querySelector("#feedback-comment-used");
  const commentError = document.querySelector("#feedback-comment-error");
  const submitButton = document.querySelector("#feedback-submit");
  const message = document.querySelector("#feedback-message");
  const successDetail = document.querySelector("[data-feedback-success-detail]");
  const editButton = document.querySelector("#feedback-edit");

  let selectedRating = 0;
  let submitting = false;
  let existingReview = null;
  let currentUserId = null;
  let authReadyHandled = false;

  function showView(view) {
    for (const key of Object.keys(views)) views[key].hidden = views[key] !== view;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    if (isError) message.dataset.state = "error";
    else delete message.dataset.state;
  }

  function setStars(rating, focus = false) {
    selectedRating = rating;
    for (const button of starButtons) {
      const value = Number(button.dataset.rating);
      button.classList.toggle("is-selected", value <= rating);
      button.setAttribute("aria-checked", String(value === rating));
      button.tabIndex = value === rating || (rating === 0 && value === 1) ? 0 : -1;
      if (value === rating && focus) button.focus();
    }
    starsLive.textContent = rating ? `Оценка: ${rating} из 5` : "Оценка не выбрана";
    ratingError.hidden = true;
    ratingError.textContent = "";
  }

  function setSubmitting(value) {
    submitting = value;
    submitButton.disabled = value;
    submitButton.textContent = value ? "Отправляем…" : (existingReview ? "Обновить отзыв" : "Отправить отзыв");
  }

  function client() {
    return window.supabase && window.GitLingo.supabaseConfig
      ? window.supabase.createClient(
        window.GitLingo.supabaseConfig.projectUrl,
        window.GitLingo.supabaseConfig.publishableKey)
      : null;
  }

  async function loadReview(supabase, userId) {
    const { data, error } = await supabase
      .from("site_reviews")
      .select("rating,comment,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false, reason: classify(error) };
    return { ok: true, review: data || null };
  }

  function classify(error) {
    const code = String(error && error.code || "").toLowerCase();
    const text = String(error && error.message || "").toLowerCase();
    if (code === "42p01" || text.includes("does not exist")) return "table-missing";
    if (code === "23514" || text.includes("check")) return "invalid-value";
    if (code === "42501" || text.includes("row-level")) return "forbidden";
    if (text.includes("fetch") || text.includes("network")) return "network";
    return "unknown";
  }

  function errorText(reason) {
    if (reason === "table-missing") return "Таблица отзывов ещё не создана. Примените миграцию supabase/migrations/20261030120000_add_site_reviews.sql в Supabase SQL Editor.";
    if (reason === "forbidden") return "Сервер не разрешил сохранить отзыв. Убедитесь, что вы вошли, и попробуйте позже.";
    if (reason === "invalid-value") return "Сервер отклонил значение: оценка должна быть от 1 до 5, комментарий до 1000 символов.";
    if (reason === "network") return "Не удалось связаться с сервисом. Проверьте подключение и попробуйте позже.";
    if (reason === "not-authenticated") return "Сессия истекла. Войдите снова.";
    return "Не удалось сохранить отзыв. Попробуйте позже.";
  }

  function fillForm(review) {
    setStars(review ? Number(review.rating) : 0);
    commentInput.value = review ? String(review.comment || "") : "";
    updateCount();
  }

  function updateCount() {
    commentUsed.textContent = String(Array.from(commentInput.value).length);
  }

  function validate() {
    let valid = true;
    if (!selectedRating) {
      ratingError.textContent = "Выберите оценку от 1 до 5 звёзд.";
      ratingError.hidden = false;
      valid = false;
    } else {
      ratingError.hidden = true;
      ratingError.textContent = "";
    }
    const length = Array.from(commentInput.value).length;
    if (length > 1000) {
      commentError.textContent = "Комментарий длиннее 1000 символов.";
      commentError.hidden = false;
      valid = false;
    } else {
      commentError.hidden = true;
      commentError.textContent = "";
    }
    return valid;
  }

  starButtons.forEach((button) => {
    button.addEventListener("click", () => setStars(Number(button.dataset.rating)));
    button.addEventListener("keydown", (event) => {
      const value = Number(button.dataset.rating);
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        setStars(Math.min(5, value + 1), true);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        setStars(Math.max(1, value - 1), true);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setStars(value);
      }
    });
  });

  commentInput.addEventListener("input", updateCount);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    const state = auth.getState();
    if (state.status !== "authenticated" || !state.userId) {
      showView(views.guest);
      return;
    }
    const existingReviewWasNew = !existingReview;
    setSubmitting(true);
    setMessage("");
    const supabase = client();
    if (!supabase) {
      setSubmitting(false);
      setMessage("Сервис недоступен. Попробуйте позже.", true);
      return;
    }
    // INSERT для нового отзыва, UPDATE только rating/comment для существующего:
    // column-grant не позволяет UPDATE user_id, поэтому upsert не используем.
    const { error } = existingReview
      ? await supabase.from("site_reviews")
          .update({ rating: selectedRating, comment: commentInput.value.trim() })
          .eq("user_id", state.userId)
      : await supabase.from("site_reviews")
          .insert({ user_id: state.userId, rating: selectedRating, comment: commentInput.value.trim() });
    setSubmitting(false);
    if (error) {
      setMessage(errorText(classify(error)), true);
      return;
    }
    existingReview = { rating: selectedRating, comment: commentInput.value.trim(), updated_at: new Date().toISOString() };
    showSuccess(existingReviewWasNew ? "Ваш отзыв сохранён." : "Изменения сохранены в вашем отзыве.");
  });

  function showSuccess(extra) {
    showView(views.success);
    successDetail.hidden = !extra;
    successDetail.textContent = extra || "";
  }

  editButton.addEventListener("click", () => {
    fillForm(existingReview);
    showView(views.form);
    setMessage("");
  });

  function onAuthState(state) {
    if (!state || !state.ready) { showView(views.loading); return; }
    if (authReadyHandled && state.userId === currentUserId) return;
    authReadyHandled = true;
    currentUserId = state.userId || null;
    const availability = auth.getAvailability();
    if (state.status !== "authenticated" || !state.userId || availability !== "available") {
      existingReview = null;
      if (state.status === "authenticated") showView(views.authError);
      else showView(views.guest);
      return;
    }
    showView(views.form);
    setSubmitting(false);
    setMessage("Загружаем ваш отзыв…");
    loadReview(client(), state.userId).then((result) => {
      if (state.userId !== (auth.getState().userId || null)) return;
      if (!result.ok) {
        existingReview = null;
        fillForm(null);
        setMessage(result.reason === "table-missing" ? errorText("table-missing") : "Не удалось загрузить прежний отзыв. Можно отправить новый.", true);
        return;
      }
      existingReview = result.review;
      fillForm(existingReview);
      setMessage(existingReview ? "Вы уже оставляли отзыв. Можно изменить его и сохранить снова." : "");
    });
  }

  window.addEventListener("mega-auth-state", (event) => onAuthState(event.detail));
  onAuthState(auth.getState());
})();
