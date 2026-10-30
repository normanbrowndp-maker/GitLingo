window.GitLingo = window.GitLingo || {};

// Модель и проверки пользовательских курсов. Зеркалит валидацию из SQL
// (gl_check_custom_course) — используется редактором, предпросмотром и бегунком.
(() => {
  const SCHEMA = "gitlingo.custom-course/1";
  const FINISH = "__finish__";

  function text(value) {
    return typeof value === "string" ? value : "";
  }

  function validId(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(value);
  }

  // Возвращает список ошибок (пустой, если курс корректен).
  function validate(course) {
    const errors = [];
    if (!course || typeof course !== "object" || Array.isArray(course)) {
      return ["Курс должен быть объектом."];
    }
    if (course.schema !== SCHEMA) {
      return ["Неизвестная схема курса."];
    }
    const title = text(course.title).trim();
    if (title.length < 1 || title.length > 120) {
      errors.push("Название курса должно быть от 1 до 120 символов.");
    }
    if (text(course.description).length > 500) {
      errors.push("Описание курса не должно превышать 500 символов.");
    }
    const lessons = Array.isArray(course.lessons) ? course.lessons : null;
    if (!lessons || lessons.length < 1 || lessons.length > 50) {
      errors.push("Курс должен содержать от 1 до 50 уроков.");
      return errors;
    }

    const questionIds = new Set();
    const order = [];
    lessons.forEach((lesson, lessonIndex) => {
      const label = `Урок ${lessonIndex + 1}`;
      if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) {
        errors.push(`${label} должен быть объектом.`);
        return;
      }
      if (!validId(lesson.id)) {
        errors.push(`${label}: некорректный идентификатор.`);
      }
      const lessonTitle = text(lesson.title).trim();
      if (lessonTitle.length < 1 || lessonTitle.length > 120) {
        errors.push(`${label}: название обязательно (1–120 символов).`);
      }
      if (text(lesson.theory).length > 5000) {
        errors.push(`«${lessonTitle}»: теория не должна превышать 5000 символов.`);
      }
      if (!Array.isArray(lesson.questions) || lesson.questions.length < 1 || lesson.questions.length > 50) {
        errors.push(`«${lessonTitle}»: нужен хотя бы один вопрос (до 50).`);
        return;
      }
      lesson.questions.forEach((question, questionIndex) => {
        const qLabel = `«${lessonTitle}», вопрос ${questionIndex + 1}`;
        if (!question || typeof question !== "object" || Array.isArray(question)) {
          errors.push(`${qLabel} должен быть объектом.`);
          return;
        }
        const qid = question.id;
        if (!validId(qid)) {
          errors.push(`${qLabel}: некорректный идентификатор.`);
        } else if (questionIds.has(qid)) {
          errors.push(`Идентификатор вопроса «${qid}» повторяется.`);
        } else {
          questionIds.add(qid);
        }
        order.push(validId(qid) ? qid : null);

        const prompt = text(question.prompt).trim();
        if (prompt.length < 1 || prompt.length > 500) {
          errors.push(`${qLabel}: условие обязательно (1–500 символов).`);
        }
        const options = Array.isArray(question.options) ? question.options : null;
        if (!options || options.length !== 4) {
          errors.push(`${qLabel}: нужно ровно 4 варианта ответа.`);
        } else {
          options.forEach((option, optionIndex) => {
            const value = text(option);
            if (value.length < 1 || value.length > 200) {
              errors.push(`${qLabel}: вариант ${optionIndex + 1} должен быть от 1 до 200 символов.`);
            }
          });
        }
        const correct = question.correct;
        if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
          errors.push(`${qLabel}: правильный ответ должен быть 0–3.`);
        }
        if (text(question.explanation).length > 1000) {
          errors.push(`${qLabel}: объяснение не должно превышать 1000 символов.`);
        }
        for (const [field, name] of [["onCorrect", "верного"], ["onWrong", "неверного"]]) {
          const transition = question[field];
          if (!transition || typeof transition !== "object" || Array.isArray(transition)) {
            errors.push(`${qLabel}: переход после ${name} ответа обязателен.`);
          } else if (transition.type === "question") {
            if (!validId(transition.questionId)) {
              errors.push(`${qLabel}: переход после ${name} ответа должен указывать на вопрос.`);
            }
          } else if (transition.type !== "next" && transition.type !== "finish") {
            errors.push(`${qLabel}: неизвестный тип перехода после ${name} ответа.`);
          }
        }
      });
    });

    if (errors.length > 0) return errors;

    // Резолвим "next" в фактические цели в порядке вопросов.
    const targets = new Map();
    order.forEach((qid, index) => {
      const lesson = lessons.find((item) => item.questions.some((question) => question.id === qid));
      const question = lesson.questions.find((item) => item.id === qid);
      const resolve = (transition) => {
        if (transition.type === "finish") return FINISH;
        if (transition.type === "question") return transition.questionId;
        return index + 1 < order.length ? order[index + 1] : FINISH;
      };
      targets.set(qid, { correct: resolve(question.onCorrect), wrong: resolve(question.onWrong) });
    });

    for (const [qid, edge] of targets) {
      for (const target of [edge.correct, edge.wrong]) {
        if (target !== FINISH && !targets.has(target)) {
          errors.push(`Вопрос «${qid}»: переход указывает на несуществующий вопрос.`);
        }
      }
    }
    if (errors.length > 0) return errors;

    // Циклы: DFS с пометкой "в пути" (серые узлы).
    const start = order[0];
    const color = new Map();
    let hasCycle = false;
    const visit = (qid) => {
      if (hasCycle) return;
      const state = color.get(qid);
      if (state === "gray") {
        hasCycle = true;
        return;
      }
      if (state === "black") return;
      color.set(qid, "gray");
      const edge = targets.get(qid);
      for (const target of [edge.correct, edge.wrong]) {
        if (target !== FINISH) visit(target);
      }
      color.set(qid, "black");
    };
    visit(start);
    if (hasCycle) {
      errors.push("В переходах найден цикл: прохождение может никогда не завершиться.");
    }

    // Достижимость завершения: обход от старта.
    const reachable = new Set([start]);
    const queue = [start];
    let finishReached = false;
    while (queue.length > 0) {
      const qid = queue.shift();
      const edge = targets.get(qid);
      for (const target of [edge.correct, edge.wrong]) {
        if (target === FINISH) {
          finishReached = true;
        } else if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }
    if (!finishReached) {
      errors.push("Завершение курса недостижимо из первого вопроса.");
    }

    return errors;
  }

  // Первый вопрос курса (с учётом порядка уроков).
  function firstQuestion(course) {
    for (const lesson of course.lessons || []) {
      if (lesson.questions && lesson.questions.length > 0) return lesson.questions[0];
    }
    return null;
  }

  // Все вопросы в порядке следования (для "следующий").
  function flatQuestions(course) {
    const result = [];
    for (const lesson of course.lessons || []) {
      for (const question of lesson.questions || []) result.push(question);
    }
    return result;
  }

  function resolveTransition(course, question, transition) {
    const flat = flatQuestions(course);
    if (transition.type === "finish") return { kind: "finish" };
    if (transition.type === "question") {
      return { kind: "question", question: flat.find((item) => item.id === transition.questionId) || null };
    }
    const index = flat.indexOf(question);
    const next = flat[index + 1];
    return next ? { kind: "question", question: next } : { kind: "finish" };
  }

  function createId(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}${random}`;
  }

  function createCourse() {
    const lessonId = createId("l");
    return {
      schema: SCHEMA,
      title: "",
      description: "",
      lessons: [{ id: lessonId, title: "", theory: "", questions: [] }]
    };
  }

  function createQuestion() {
    return {
      id: createId("q"),
      prompt: "",
      options: ["", "", "", ""],
      correct: 0,
      explanation: "",
      onCorrect: { type: "next" },
      onWrong: { type: "next" }
    };
  }

  window.GitLingo.customCourse = Object.freeze({
    SCHEMA,
    FINISH,
    validate,
    firstQuestion,
    flatQuestions,
    resolveTransition,
    createId,
    createCourse,
    createQuestion
  });
})();
