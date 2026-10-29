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

(() => {
  const accountLink = document.querySelector("[data-auth-nav-link]");
  if (!accountLink) return;

  function renderAccountLink(authState) {
    if (!authState || !authState.ready) {
      accountLink.hidden = true;
      accountLink.setAttribute("aria-busy", "true");
      return;
    }

    accountLink.textContent = authState.status === "authenticated" ? "Аккаунт" : "Войти";
    accountLink.hidden = false;
    accountLink.removeAttribute("aria-busy");
  }

  renderAccountLink(window.GitLingo && window.GitLingo.auth && window.GitLingo.auth.getState());
  window.addEventListener("mega-auth-state", (event) => renderAccountLink(event.detail));
})();
