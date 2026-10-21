const currentPage = window.location.pathname.split("/").pop() || "index.html";

for (const link of document.querySelectorAll("[data-nav-link]")) {
  const linkPage = new URL(link.href, window.location.href).pathname.split("/").pop();
  if (linkPage === currentPage) {
    link.classList.add("is-active");
  }
}

const taskTitle = document.querySelector("#task-title");
if (taskTitle) {
  const lessonId = new URLSearchParams(window.location.search).get("id") || "1";
  taskTitle.textContent = `Урок ${lessonId}`;
}
