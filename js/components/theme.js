import { getSetting, saveSetting } from "../data/database.js";

const validThemes = new Set(["light", "dark", "auto"]);
let activeUserId = null;
let listenersInstalled = false;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme]").forEach((button) => {
    if (button.tagName !== "BUTTON") return;
    const selected = button.dataset.theme === theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const note = document.querySelector("#theme-note");
  if (note) note.textContent = theme === "auto"
    ? "Following your device appearance"
    : `${theme[0].toUpperCase()}${theme.slice(1)} appearance selected`;
}

export async function initializeTheme(userId) {
  activeUserId = userId;
  let savedTheme = "light";
  try {
    const settings = await getSetting(userId);
    if (validThemes.has(settings.theme)) savedTheme = settings.theme;
  } catch {
    document.querySelector("#theme-note").textContent = "Could not read saved appearance; using Light for now.";
  }
  applyTheme(savedTheme);

  if (listenersInstalled) return;
  listenersInstalled = true;
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
  document.querySelectorAll(".theme-option").forEach((button) => {
    button.addEventListener("click", async () => {
      const theme = button.dataset.theme;
      if (!validThemes.has(theme)) return;
      applyTheme(theme);
      if (!activeUserId) return;
      try {
        await saveSetting(activeUserId, "theme", theme);
      } catch {
        document.querySelector("#theme-note").textContent = "Theme changed for this session, but could not be saved.";
      }
    });
  });
  systemPreference.addEventListener("change", () => {
    if (document.documentElement.dataset.theme === "auto") applyTheme("auto");
  });
}
