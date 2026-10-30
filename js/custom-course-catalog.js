window.GitLingo = window.GitLingo || {};

// Каталог пользовательских курсов: свои (черновики и опубликованные) + чужие опубликованные.
(() => {
  const api = () => window.GitLingo.customCourseApi;

  function setStatus(message) {
    const element = document.querySelector("#catalog-status");
    if (!message) {
      element.hidden = true;
      element.textContent = "";
      return;
    }
    element.hidden = false;
    element.textContent = message;
  }

  function courseItem(row, isMine) {
    const item = document.createElement("li");
    item.className = "cc-course-item";

    // Свои курсы: id из custom_courses; чужие: course_id из таблицы публикаций.
    const courseId = isMine ? row.id : row.course_id;
    const link = document.createElement("a");
    link.href = isMine
      ? `course-editor.html?id=${encodeURIComponent(courseId)}`
      : `course-run.html?id=${encodeURIComponent(courseId)}`;
    link.className = "cc-course-link";

    const title = document.createElement("strong");
    title.textContent = row.title || "Без названия";
    const meta = document.createElement("span");
    meta.textContent = isMine && row.status === "published" ? "Опубликовано" : "Черновик";
    meta.className = "cc-course-status";
    link.append(title, meta);

    if (isMine && row.status === "published") {
      const play = document.createElement("a");
      play.href = `course-run.html?id=${encodeURIComponent(courseId)}`;
      play.className = "btn btn--secondary";
      play.textContent = "Пройти";
      item.append(link, play);
      item.className += " cc-course-item--split";
      return item;
    }
    item.append(link);
    return item;
  }

  function emptyItem(text) {
    const item = document.createElement("li");
    item.className = "cc-course-item cc-course-item--empty";
    item.textContent = text;
    return item;
  }

  async function refresh() {
    setStatus("");
    const mine = await api().listOwn();
    if (!mine.ok) {
      setStatus(mine.reason);
      return;
    }
    const published = await api().listPublished();
    if (!published.ok) {
      setStatus(published.reason);
      return;
    }

    const mineList = document.querySelector("#mine-list");
    mineList.replaceChildren();
    if (mine.rows.length === 0) mineList.append(emptyItem("Пока нет своих курсов."));
    for (const row of mine.rows) mineList.append(courseItem(row, true));

    const publishedList = document.querySelector("#published-list");
    publishedList.replaceChildren();
    if (published.rows.length === 0) publishedList.append(emptyItem("Опубликованных курсов пока нет."));
    for (const row of published.rows) {
      if (!mine.rows.some((own) => own.id === row.course_id)) {
        publishedList.append(courseItem(row, false));
      }
    }
  }

  function waitForAuth() {
    const state = window.GitLingo.auth && window.GitLingo.auth.getState();
    if (state && state.ready) {
      if (state.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы видеть свои курсы.");
      refresh();
      return;
    }
    window.addEventListener("mega-auth-state", (event) => {
      if (event.detail && event.detail.ready) {
        if (event.detail.status !== "authenticated") setStatus("Войдите в аккаунт, чтобы видеть свои курсы.");
        refresh();
      }
    }, { once: true });
  }

  waitForAuth();
})();
