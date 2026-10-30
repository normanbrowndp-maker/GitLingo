window.GitLingo = window.GitLingo || {};

// Редактор курсов: уроки, вопросы, переходы, порядок, сохранение и публикация.
(() => {
  const model = () => window.GitLingo.customCourse;
  const api = () => window.GitLingo.customCourseApi;

  const courseId = new URLSearchParams(window.location.search).get("id") || "";
  let course = courseId ? null : model().createCourse();
  let dirty = false;

  const lessonList = document.querySelector("#lesson-list");

  function setStatus(message) {
    const element = document.querySelector("#editor-status");
    if (!message) {
      element.hidden = true;
      element.textContent = "";
      return;
    }
    element.hidden = false;
    element.textContent = message;
  }

  function markDirty() {
    dirty = true;
  }

  function collectMeta() {
    course.title = document.querySelector("#course-title").value.trim();
    course.description = document.querySelector("#course-description").value.trim();
  }

  function applyMeta() {
    document.querySelector("#course-title").value = course.title || "";
    document.querySelector("#course-description").value = course.description || "";
  }

  // ---------- Переходы ----------

  function transitionValue(transition) {
    if (!transition) return "next";
    if (transition.type === "question") return `q:${transition.questionId}`;
    return transition.type;
  }

  function parseTransition(value) {
    if (value === "finish") return { type: "finish" };
    if (value && value.startsWith("q:")) return { type: "question", questionId: value.slice(2) };
    return { type: "next" };
  }

  function allQuestions() {
    const result = [];
    for (const lesson of course.lessons) {
      for (const question of lesson.questions) result.push(question);
    }
    return result;
  }

  // ---------- Рендер ----------

  function render() {
    applyMeta();
    lessonList.replaceChildren();
    course.lessons.forEach((lesson, lessonIndex) => {
      lessonList.append(renderLesson(lesson, lessonIndex));
    });
  }

  function moveButton(label, disabled, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--secondary cc-move-btn";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", handler);
    return button;
  }

  function renderLesson(lesson, lessonIndex) {
    const card = document.createElement("article");
    card.className = "cc-lesson";
    card.draggable = true;
    card.dataset.lessonIndex = String(lessonIndex);

    const header = document.createElement("div");
    header.className = "cc-lesson__header";

    const dragHandle = document.createElement("span");
    dragHandle.className = "cc-drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Перетащите, чтобы изменить порядок";

    const title = document.createElement("h2");
    title.textContent = `Урок ${lessonIndex + 1}`;

    const controls = document.createElement("div");
    controls.className = "cc-block-controls";
    controls.append(
      moveButton("↑", lessonIndex === 0, () => swapLessons(lessonIndex, lessonIndex - 1)),
      moveButton("↓", lessonIndex === course.lessons.length - 1, () => swapLessons(lessonIndex, lessonIndex + 1)),
      (() => {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn--secondary cc-remove-btn";
        remove.textContent = "Удалить";
        remove.addEventListener("click", async () => {
          const choice = await window.GitLingo.ui.modal("Удалить урок?", "Урок и все его вопросы будут удалены из черновика.", [
            { label: "Удалить", value: "ok", className: "btn btn--primary" },
            { label: "Отмена", value: "cancel" }
          ]);
          if (choice !== "ok") return;
          course.lessons.splice(lessonIndex, 1);
          if (course.lessons.length === 0) course.lessons.push({ ...emptyLesson() });
          markDirty();
          render();
        });
        return remove;
      })()
    );

    header.append(dragHandle, title, controls);
    card.append(header);

    const lessonTitleField = fieldInput("Название урока", lesson.title, 120, (value) => {
      lesson.title = value;
      markDirty();
    });
    const theoryField = fieldTextarea("Текст теории", lesson.theory, 5000, (value) => {
      lesson.theory = value;
      markDirty();
    });
    card.append(lessonTitleField, theoryField);

    const questionList = document.createElement("div");
    questionList.className = "cc-question-list";
    lesson.questions.forEach((question, questionIndex) => {
      questionList.append(renderQuestion(lesson, lessonIndex, question, questionIndex));
    });
    card.append(questionList);

    const addQuestion = document.createElement("button");
    addQuestion.type = "button";
    addQuestion.className = "btn btn--secondary";
    addQuestion.textContent = "Добавить вопрос";
    addQuestion.addEventListener("click", () => {
      lesson.questions.push(model().createQuestion());
      markDirty();
      render();
    });
    card.append(addQuestion);

    attachDragHandlers(card, "lesson", lessonIndex);
    return card;
  }

  function emptyLesson() {
    return { id: model().createId("l"), title: "", theory: "", questions: [] };
  }

  function renderQuestion(lesson, lessonIndex, question, questionIndex) {
    const card = document.createElement("article");
    card.className = "cc-question";
    card.draggable = true;
    card.dataset.lessonIndex = String(lessonIndex);
    card.dataset.questionIndex = String(questionIndex);

    const header = document.createElement("div");
    header.className = "cc-question__header";

    const dragHandle = document.createElement("span");
    dragHandle.className = "cc-drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Перетащите, чтобы изменить порядок";

    const title = document.createElement("h3");
    title.textContent = `Вопрос ${questionIndex + 1}`;

    const controls = document.createElement("div");
    controls.className = "cc-block-controls";
    controls.append(
      moveButton("↑", questionIndex === 0, () => swapQuestions(lesson, questionIndex, questionIndex - 1)),
      moveButton("↓", questionIndex === lesson.questions.length - 1, () => swapQuestions(lesson, questionIndex, questionIndex + 1)),
      (() => {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn--secondary cc-remove-btn";
        remove.textContent = "Удалить";
        remove.addEventListener("click", async () => {
          const choice = await window.GitLingo.ui.modal("Удалить вопрос?", "Вопрос будет удалён из черновика.", [
            { label: "Удалить", value: "ok", className: "btn btn--primary" },
            { label: "Отмена", value: "cancel" }
          ]);
          if (choice !== "ok") return;
          lesson.questions.splice(questionIndex, 1);
          markDirty();
          render();
        });
        return remove;
      })()
    );

    header.append(dragHandle, title, controls);
    card.append(header);

    card.append(fieldInput("Условие вопроса", question.prompt, 500, (value) => {
      question.prompt = value;
      markDirty();
    }));

    const optionsBlock = document.createElement("fieldset");
    optionsBlock.className = "cc-options";
    const legend = document.createElement("legend");
    legend.textContent = "Варианты ответа (отметьте правильный)";
    optionsBlock.append(legend);

    question.options.forEach((option, optionIndex) => {
      const row = document.createElement("div");
      row.className = "cc-option-row";

      const radioId = `correct-${question.id}-${optionIndex}`;
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `correct-${question.id}`;
      radio.id = radioId;
      radio.checked = question.correct === optionIndex;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          question.correct = optionIndex;
          markDirty();
        }
      });

      const label = document.createElement("label");
      label.htmlFor = radioId;
      label.className = "visually-hidden";
      label.textContent = `Правильный вариант ${optionIndex + 1}`;

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 200;
      input.placeholder = `Вариант ${optionIndex + 1}`;
      input.value = option;
      input.addEventListener("input", () => {
        question.options[optionIndex] = input.value;
        markDirty();
      });

      row.append(radio, label, input);
      optionsBlock.append(row);
    });
    card.append(optionsBlock);

    card.append(fieldTextarea("Объяснение после проверки", question.explanation, 1000, (value) => {
      question.explanation = value;
      markDirty();
    }));

    const transitionsBlock = document.createElement("fieldset");
    transitionsBlock.className = "cc-transitions";
    const transitionsLegend = document.createElement("legend");
    transitionsLegend.textContent = "Переходы";
    transitionsBlock.append(transitionsLegend);

    for (const [key, label] of [["onCorrect", "После верного ответа"], ["onWrong", "После неверного ответа"]]) {
      const row = document.createElement("div");
      row.className = "cc-transition-row";

      const selectLabel = document.createElement("label");
      selectLabel.textContent = label;
      selectLabel.htmlFor = `${key}-${question.id}`;

      const select = document.createElement("select");
      select.id = `${key}-${question.id}`;
      const options = [
        ["next", "Следующий вопрос"],
        ["finish", "Завершить курс"],
        ...allQuestions().filter((item) => item.id !== question.id).map((item) => [`q:${item.id}`, `Вопрос: ${item.prompt || item.id}`])
      ];
      for (const [value, text] of options) {
        const optionElement = document.createElement("option");
        optionElement.value = value;
        optionElement.textContent = text;
        select.append(optionElement);
      }
      select.value = transitionValue(question[key]);
      if (select.selectedIndex === -1) select.value = "next";
      select.addEventListener("change", () => {
        question[key] = parseTransition(select.value);
        markDirty();
      });

      row.append(selectLabel, select);
      transitionsBlock.append(row);
    }
    card.append(transitionsBlock);

    attachDragHandlers(card, "question", { lesson, lessonIndex, questionIndex });
    return card;
  }

  function fieldInput(labelText, value, maxLength, onInput) {
    const field = document.createElement("div");
    field.className = "cc-field";
    const id = model().createId("f");
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = id;
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.maxLength = maxLength;
    input.value = value || "";
    input.addEventListener("input", () => onInput(input.value.trim()));
    field.append(label, input);
    return field;
  }

  function fieldTextarea(labelText, value, maxLength, onInput) {
    const field = document.createElement("div");
    field.className = "cc-field";
    const id = model().createId("f");
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = id;
    const textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.id = id;
    textarea.maxLength = maxLength;
    textarea.value = value || "";
    textarea.addEventListener("input", () => onInput(textarea.value));
    field.append(label, textarea);
    return field;
  }

  // ---------- Перестановка ----------

  function swapLessons(a, b) {
    if (b < 0 || b >= course.lessons.length) return;
    [course.lessons[a], course.lessons[b]] = [course.lessons[b], course.lessons[a]];
    markDirty();
    render();
  }

  function swapQuestions(lesson, a, b) {
    if (b < 0 || b >= lesson.questions.length) return;
    [lesson.questions[a], lesson.questions[b]] = [lesson.questions[b], lesson.questions[a]];
    markDirty();
    render();
  }

  function attachDragHandlers(card, kind, payload) {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({ kind, payload }));
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("is-drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drag-over"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drag-over");
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData("text/plain"));
      } catch {
        return;
      }
      if (!data || data.kind !== kind) return;

      if (kind === "lesson") {
        const from = data.payload;
        const to = payload;
        if (from === to) return;
        const [moved] = course.lessons.splice(from, 1);
        course.lessons.splice(to, 0, moved);
      } else {
        const from = data.payload;
        const to = payload;
        if (from.lesson === to.lesson && from.questionIndex === to.questionIndex) return;
        if (from.lesson === to.lesson) {
          const list = from.lesson.questions;
          const [moved] = list.splice(from.questionIndex, 1);
          list.splice(to.questionIndex, 0, moved);
        } else {
          const [moved] = from.lesson.questions.splice(from.questionIndex, 1);
          to.lesson.questions.splice(to.questionIndex, 0, moved);
        }
      }
      markDirty();
      render();
    });
  }

  // ---------- Сохранение и публикация ----------

  function validationMessage(prefix, errors) {
    return `${prefix}: ${errors.join(" ")}`;
  }

  async function saveDraft({ silent = false } = {}) {
    collectMeta();
    if (!courseId) {
      const created = await api().createCourse(course.title, course.description, course);
      if (!created.ok) {
        setStatus(`Не удалось создать черновик: ${created.reason}`);
        return false;
      }
      window.location.href = `course-editor.html?id=${encodeURIComponent(created.row.id)}`;
      return true;
    }
    const result = await api().updateDraft(courseId, {
      title: course.title,
      description: course.description,
      content: course
    });
    if (!result.ok) {
      setStatus(`Не удалось сохранить черновик: ${result.reason}`);
      return false;
    }
    dirty = false;
    if (!silent) setStatus("Черновик сохранён.");
    return true;
  }

  async function publish() {
    collectMeta();
    const errors = model().validate(course);
    if (errors.length > 0) {
      setStatus(validationMessage("Публикация отклонена (локальная проверка)", errors));
      return;
    }
    const saved = courseId
      ? await api().updateDraft(courseId, { title: course.title, description: course.description, content: course })
      : null;
    if (courseId && !saved.ok) {
      setStatus(`Не удалось сохранить черновик: ${saved.reason}`);
      return;
    }
    const targetId = courseId || (await createDraftForPublish());
    if (!targetId) return;
    const published = await api().publishCourse(targetId, course);
    if (!published.ok) {
      setStatus(`Публикация отклонена: ${published.reason}`);
      return;
    }
    dirty = false;
    setStatus("Курс опубликован. Дальнейшие правки черновика не изменят опубликованную версию.");
  }

  async function createDraftForPublish() {
    const created = await api().createCourse(course.title, course.description, course);
    if (!created.ok) {
      setStatus(`Не удалось создать черновик: ${created.reason}`);
      return null;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("id", created.row.id);
    window.history.replaceState(window.history.state, document.title, url.href);
    return created.row.id;
  }

  // ---------- Предпросмотр ----------

  function openPreview() {
    collectMeta();
    const errors = model().validate(course);
    if (errors.length > 0) {
      setStatus(validationMessage("Предпросмотр недоступен", errors));
      return;
    }
    try {
      window.sessionStorage.setItem("gl-course-preview", JSON.stringify(course));
      window.open("course-run.html?preview=1", "_blank", "noopener");
    } catch {
      setStatus("Предпросмотр недоступен: не удалось сохранить локальную копию курса.");
    }
  }

  // ---------- Загрузка ----------

  async function loadExisting() {
    if (!courseId) {
      render();
      return;
    }
    const loaded = await api().getCourse(courseId);
    if (!loaded.ok) {
      setStatus(loaded.reason);
      return;
    }
    const row = loaded.row;
    if (row.status !== "draft") {
      setStatus("Этот курс уже опубликован. Правки будут только в черновике и появятся на сайте после повторной публикации.");
    }
    const content = row.content || model().createCourse();
    if (content.schema !== model().SCHEMA) {
      setStatus("Курс сохранён в неизвестной схеме.");
      return;
    }
    course = content;
    dirty = false;
    render();
  }

  document.querySelector("#add-lesson").addEventListener("click", () => {
    course.lessons.push(emptyLesson());
    markDirty();
    render();
  });
  document.querySelector("#save-draft").addEventListener("click", () => saveDraft());
  document.querySelector("#publish-course").addEventListener("click", () => publish());
  document.querySelector("#preview-course").addEventListener("click", () => openPreview());

  function waitForAuth() {
    const state = window.GitLingo.auth && window.GitLingo.auth.getState();
    if (state && state.ready) {
      if (state.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы создавать и редактировать курсы.");
      loadExisting();
      return;
    }
    window.addEventListener("mega-auth-state", (event) => {
      if (event.detail && event.detail.ready) {
        if (event.detail.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы создавать и редактировать курсы.");
        loadExisting();
      }
    }, { once: true });
  }

  waitForAuth();
})();
