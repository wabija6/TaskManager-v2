import { initializeNavigation } from "./components/navigation.js";
import { initializeTheme } from "./components/theme.js";
import { showToast } from "./components/toast.js";
import { renderView } from "./views/view-shell.js";
import { initializeAuth, signOut } from "./auth/auth.js";
import { renderTasksView, openNewTask } from "./views/tasks.js";

const viewMeta = {
  dashboard: { eyebrow: "YOUR WORKSPACE", title: "Dashboard", subtitle: "Here's your task overview for today.", icon: "icon-grid", stage: "Live dashboard arrives in Stage 5." },
  tasks: { eyebrow: "STAY ORGANIZED", title: "Tasks", subtitle: "Capture, prioritize, and keep track of your work.", icon: "icon-list", stage: "Search, filter, and sort your saved tasks." },
  calendar: { eyebrow: "PLAN AHEAD", title: "Calendar", subtitle: "See your deadlines and plan the days ahead.", icon: "icon-calendar", stage: "Interactive calendar arrives in Stage 7." },
  kanban: { eyebrow: "MOVE WORK FORWARD", title: "Kanban", subtitle: "Follow work from to do, through progress, to completion.", icon: "icon-columns", stage: "Kanban board arrives in Stage 6." },
  settings: { eyebrow: "MAKE IT YOURS", title: "Settings", subtitle: "Manage your workspace preferences and data.", icon: "icon-settings", stage: "Profile, backup, and data settings arrive in Stage 8." }
};

const state = { currentView: "dashboard", user: null, workspaceInitialized: false };
const mainContent = document.querySelector("#main-content");
const viewContent = document.querySelector("#view-content");
const pageTitle = document.querySelector("#page-title");
const pageEyebrow = document.querySelector("#page-eyebrow");
const pageSubtitle = document.querySelector("#page-subtitle");
const currentDate = document.querySelector("#current-date");
const searchInput = document.querySelector("#global-search");
const announcer = document.querySelector("#announcer");

function updateDate() {
  currentDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function updateGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  pageTitle.replaceChildren(document.createTextNode(`${greeting}, ${state.user?.displayName || "there"} `));
  const wave = document.createElement("span");
  wave.className = "greeting-wave";
  wave.setAttribute("aria-hidden", "true");
  wave.textContent = "👋";
  pageTitle.append(wave);
}

function navigate(viewName, { focusMain = false } = {}) {
  if (!Object.hasOwn(viewMeta, viewName)) return;
  state.currentView = viewName;
  const meta = viewMeta[viewName];
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    if (button.classList.contains("nav-item")) {
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });
  pageEyebrow.textContent = meta.eyebrow;
  pageSubtitle.textContent = meta.subtitle;
  if (viewName === "dashboard") updateGreeting();
  else pageTitle.textContent = meta.title;
  if (viewName === "tasks" && state.user) {
    renderTasksView(viewContent, state.user.id, () => { if (state.currentView === "tasks") renderTasksView(viewContent, state.user.id); }).catch((error) => showToast(error instanceof Error ? `Could not load tasks: ${error.message}` : "Could not load tasks.", "error"));
  } else { renderView(viewContent, viewName, meta); }
  closeMobileNav();
  if (focusMain) mainContent.focus();
  announcer.textContent = `${meta.title} view opened.`;
  if (location.hash !== `#${viewName}`) history.replaceState(null, "", `#${viewName}`);
}

function openMobileNav() {
  document.querySelector("#sidebar").classList.add("is-open");
  document.querySelector("#mobile-scrim").classList.add("is-visible");
  document.querySelector("#mobile-menu-button").setAttribute("aria-expanded", "true");
  document.querySelector("#mobile-menu-button").setAttribute("aria-label", "Close navigation");
}
function closeMobileNav() {
  document.querySelector("#sidebar").classList.remove("is-open");
  document.querySelector("#mobile-scrim").classList.remove("is-visible");
  document.querySelector("#mobile-menu-button").setAttribute("aria-expanded", "false");
  document.querySelector("#mobile-menu-button").setAttribute("aria-label", "Open navigation");
}

function initializeWorkspaceEvents() {
  if (state.workspaceInitialized) return;
  state.workspaceInitialized = true;
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
  document.querySelector("[data-view-link='dashboard']").addEventListener("click", (event) => { event.preventDefault(); navigate("dashboard"); });
  document.querySelector("#mobile-menu-button").addEventListener("click", () => {
    const expanded = document.querySelector("#mobile-menu-button").getAttribute("aria-expanded") === "true";
    if (expanded) closeMobileNav(); else openMobileNav();
  });
  document.querySelector("#mobile-scrim").addEventListener("click", closeMobileNav);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNav();
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) { event.preventDefault(); searchInput.focus(); }
  });
  document.querySelector("#notifications-button").addEventListener("click", () => showToast("No new notifications.", "info"));
  document.querySelector("#messages-button").addEventListener("click", () => showToast("No new messages.", "info"));
  document.querySelector("#logout-button").addEventListener("click", signOut);
  document.querySelector("#new-task-button").addEventListener("click", () => openNewTask());
  document.querySelector("#empty-create-button").addEventListener("click", () => { navigate("tasks"); showToast("Create and manage your tasks here.", "info"); });
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (state.currentView !== "tasks") {
      let feedback = document.querySelector("#search-feedback");
      if (!query) { feedback?.remove(); return; }
      if (!feedback) { feedback = document.createElement("p"); feedback.id = "search-feedback"; feedback.className = "search-feedback"; viewContent.prepend(feedback); }
      feedback.textContent = "Open Tasks to search, filter, and sort your saved tasks.";
      return;
    }
    const localSearch = viewContent.querySelector(".task-filter-search input");
    if (localSearch && localSearch.value !== query) { localSearch.value = query; localSearch.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { searchInput.value = ""; document.querySelector("#search-feedback")?.remove(); searchInput.blur(); }
  });
}

async function onAuthenticated(user) {
  state.user = user;
  document.querySelector("#profile-name").textContent = user.displayName;
  document.querySelector("#profile-avatar").textContent = Array.from(user.displayName.trim())[0]?.toUpperCase() || "U";
  await initializeTheme(user.id);
  initializeWorkspaceEvents();
  initializeNavigation();
  updateDate();
  updateGreeting();
  const hashView = location.hash.replace("#", "");
  navigate(Object.hasOwn(viewMeta, hashView) ? hashView : "dashboard");
}

function onSignedOut() {
  state.user = null;
  document.documentElement.dataset.theme = "light";
  showToast("You have signed out of this local account.", "info");
}

initializeAuth({ onAuthenticated, onSignedOut }).catch((error) => {
  const feedback = document.querySelector("#auth-feedback");
  feedback.textContent = error instanceof Error ? error.message : "TaskManager could not start. Refresh and try again.";
  feedback.hidden = false;
});
