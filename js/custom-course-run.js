window.GitLingo = window.GitLingo || {};

// Прохождение пользовательского курса или предпросмотр из редактора.
// Теория и вопросы выводятся через textContent; правильный ответ скрыт до проверки.
(() => {
  const model = () => window.GitLingo.customCourse;
  const api = () => window.GitLingo.customCourseApi;

  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("preview") === "1";
  const courseId = params.get("id") || "";

  let course = null;
  let currentQuestion = null;
  let checked = false;
  let selectedIndex = null;

  const runTitle = document.querySelector("#run-title");
  const runDescription = document.querySelector("#run-description");
  const runStatus = document.querySelector("#run-status");
  const runContent = document.querySelector("#run-content");

  function setStatus(message) {
    if (!message) {
      runStatus.hidden = true;
      runStatus.textContent = "";
      return;
    }
    runStatus.hidden = false;
    runStatus.textContent = message;
  }

  function clearContent() {
    runContent.replaceChildren();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderTheory() {
    clearContent();
    const lessonsBlock = element("div", "cc-theory");
    for (const lesson of course.lessons) {
      if (lesson.theory && lesson.theory.trim().length > 0) {
        lessonsBlock.append(element("h2", "cc-theory__title", lesson.title || "Урок"));
        lessonsBlock.append(element("p", "cc-theory__text", lesson.theory));
      }
    }
    const startButton = element("button", "btn btn--primary", "Начать");
    startButton.type = "button";
    startButton.addEventListener("click", () => {
      currentQuestion = model().firstQuestion(course);
      renderQuestion();
    });
    if (lessonsBlock.childElementCount > 0) runContent.append(lessonsBlock);
    runContent.append(startButton);
  }

  function renderFinish() {
    clearContent();
    runContent.append(element("h2", "cc-finish__title", "Курс завершён"));
    const again = element("button", "btn btn--primary", "Пройти снова");
    again.type = "button";
    again.addEventListener("click", () => {
      checked = false;
      selectedIndex = null;
      renderTheory();
    });
    runContent.append(again);
  }

  function renderQuestion() {
    clearContent();
    checked = false;
    selectedIndex = null;
    if (!currentQuestion) {
      renderFinish();
      return;
    }

    const questionBlock = element("div", "cc-question-run");
    questionBlock.append(element("p", "cc-question-run__prompt", currentQuestion.prompt));

    const form = element("div", "cc-question-run__options");
    form.setAttribute("role", "radiogroup");
    const radioName = `answer-${currentQuestion.id}`;
    currentQuestion.options.forEach((option, index) => {
      const label = element("label", "cc-answer-option");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = radioName;
      radio.value = String(index);
      radio.addEventListener("change", () => {
        selectedIndex = index;
        checkButton.disabled = false;
      });
      label.append(radio, element("span", "cc-answer-option__text", option));
      form.append(label);
    });
    questionBlock.append(form);

    const feedback = element("p", "cc-question-run__feedback");
    feedback.hidden = true;

    const actions = element("div", "cc-question-run__actions");
    const checkButton = element("button", "btn btn--primary", "Проверить");
    checkButton.type = "button";
    checkButton.disabled = true;
    checkButton.addEventListener("click", () => {
      if (checked || selectedIndex === null) return;
      checked = true;
      const correct = selectedIndex === currentQuestion.correct;
      for (const label of form.querySelectorAll("label")) {
        label.classList.add("is-locked");
        const input = label.querySelector("input");
        input.disabled = true;
      }
      feedback.hidden = false;
      feedback.textContent = correct
        ? (currentQuestion.explanation || "Верно!")
        : `Неверно. ${currentQuestion.explanation || ""}`.trim();
      nextButton.hidden = false;
      checkButton.disabled = true;
    });
    const nextButton = element("button", "btn btn--secondary", "Продолжить");
    nextButton.type = "button";
    nextButton.hidden = true;
    nextButton.addEventListener("click", () => {
      const transition = checked && selectedIndex === currentQuestion.correct
        ? currentQuestion.onCorrect
        : currentQuestion.onWrong;
      const resolved = model().resolveTransition(course, currentQuestion, transition);
      selectedIndex = null;
      if (resolved.kind === "finish" || !resolved.question) {
        renderFinish();
        return;
      }
      currentQuestion = resolved.question;
      renderQuestion();
    });
    actions.append(checkButton, nextButton);

    questionBlock.append(actions, feedback);
    runContent.append(questionBlock);
  }

  async function loadCourse() {
    if (previewMode) {
      try {
        const raw = window.sessionStorage.getItem("gl-course-preview");
        if (!raw) {
          setStatus("Предпросмотр недоступен: нет данных курса.");
          return;
        }
        course = JSON.parse(raw);
      } catch {
        setStatus("Предпросмотр недоступен: повреждённые данные курса.");
        return;
      }
      if (!course || course.schema !== model().SCHEMA || model().validate(course).length > 0) {
        setStatus("Предпросмотр недоступен: курс не прошёл локальную проверку.");
        return;
      }
      runTitle.textContent = course.title || "Предпросмотр курса";
      runDescription.textContent = course.description || "";
      renderTheory();
      return;
    }

    if (!courseId) {
      setStatus("Курс не указан.");
      return;
    }
    const loaded = await api().getPublished(courseId);
    if (!loaded.ok) {
      setStatus(loaded.reason);
      return;
    }
    const content = loaded.publication.snapshot;
    if (!content || content.schema !== model().SCHEMA) {
      setStatus("Содержимое курса недоступно или сохранено в неизвестной схеме.");
      return;
    }
    const errors = model().validate(content);
    if (errors.length > 0) {
      setStatus("Курс не прошёл проверку структуры.");
      return;
    }
    course = content;
    runTitle.textContent = course.title || "Курс";
    runDescription.textContent = course.description || "";
    renderTheory();
  }

  function waitForAuth() {
    const state = window.GitLingo.auth && window.GitLingo.auth.getState();
    if (state && state.ready) {
      if (!previewMode && state.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы проходить курсы.");
      loadCourse();
      return;
    }
    window.addEventListener("mega-auth-state", (event) => {
      if (event.detail && event.detail.ready) {
        if (!previewMode && event.detail.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы проходить курсы.");
        loadCourse();
      }
    }, { once: true });
  }

  waitForAuth();
})();
