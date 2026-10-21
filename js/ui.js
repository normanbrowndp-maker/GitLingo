window.MEGA = window.MEGA || {};

(() => {
  let toastTimer;
  let modal;

  function updateStreak() {
    if (!window.MEGA.state) return;
    const streak = window.MEGA.state.get().streak;
    for (const element of document.querySelectorAll("#streak-count, [data-streak-count], .site-header__streak")) {
      element.textContent = `🔥 ${streak}`;
    }
  }

  function streakLabel(value) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    const lastTwo = count % 100;
    const lastOne = count % 10;
    const word = lastTwo >= 11 && lastTwo <= 14 ? "дней"
      : (lastOne === 1 ? "день" : (lastOne >= 2 && lastOne <= 4 ? "дня" : "дней"));
    return `${count} ${word}`;
  }

  function showToast(message) {
    let region = document.querySelector("#toast-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "toast-region";
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }

    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = String(message);
    region.replaceChildren(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 3200);
  }

  function getModal() {
    if (modal) return modal;
    modal = document.querySelector("#modal");
    if (!modal) {
      modal = document.createElement("dialog");
      modal.id = "modal";
      modal.className = "app-modal";
      document.body.append(modal);
    }
    return modal;
  }

  function showModal(title, message, actions) {
    const dialog = getModal();
    const heading = document.createElement("h2");
    heading.id = "modal-title";
    heading.textContent = title;
    dialog.setAttribute("aria-labelledby", heading.id);

    const description = document.createElement("p");
    description.textContent = message;

    const actionList = document.createElement("div");
    actionList.className = "app-modal__actions";
    dialog.replaceChildren(heading, description, actionList);
    dialog.returnValue = "";

    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue || "cancel"), { once: true });
      for (const action of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = action.className || "btn btn--secondary";
        button.dataset.modalAction = action.value;
        button.textContent = action.label;
        button.addEventListener("click", () => dialog.close(action.value));
        actionList.append(button);
      }
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      actionList.querySelector("button")?.focus();
    });
  }

  function shuffle(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  window.MEGA.ui = {
    updateStreak,
    streakLabel,
    toast: showToast,
    modal: showModal,
    shuffle
  };

  updateStreak();
})();
