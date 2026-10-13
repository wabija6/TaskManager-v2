const region = document.querySelector("#toast-region");

export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast-error" : ""}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());

  toast.append(text, close);
  toast.addEventListener("click", (event) => {
    if (event.target !== close) toast.remove();
  });
  region.append(toast);

  window.setTimeout(() => toast.remove(), 3500);
}
