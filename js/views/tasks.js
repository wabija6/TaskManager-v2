import { getTasksForUser, saveTask, deleteTask } from "../data/database.js";
import { showToast } from "../components/toast.js";

const statuses = ["todo", "in-progress", "completed"];
const statusLabels = { todo: "To do", "in-progress": "In progress", completed: "Completed" };
const priorities = ["low", "medium", "high"];
const priorityLabels = { low: "Low", medium: "Medium", high: "High" };
let currentUserId = null;
let tasks = [];
let container = null;
let onChanged = () => {};
let listFilters = { query: "", status: "all", priority: "all", sort: "due" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function dateLabel(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "No due date" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}
function isOverdue(task) { return task.status !== "completed" && task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10); }

export async function loadTasks(userId) {
  currentUserId = userId;
  tasks = await getTasksForUser(userId);
  tasks.sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || b.updatedAt.localeCompare(a.updatedAt));
  return tasks;
}
export function getLoadedTasks() { return [...tasks]; }

function openTaskDialog(task = null) {
  const dialog = el("dialog", "task-dialog");
  dialog.setAttribute("aria-labelledby", "task-dialog-title");
  const form = el("form", "task-form");
  form.method = "dialog";
  const heading = el("div", "task-dialog-heading");
  heading.append(el("h2", "", task ? "Edit task" : "Create a task"), el("p", "", "Keep the next step clear and manageable."));
  heading.firstElementChild.id = "task-dialog-title";
  const close = el("button", "icon-button task-dialog-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close dialog");
  heading.append(close);
  const titleLabel = el("label", "task-field", "Task title *");
  const title = el("input"); title.name = "title"; title.required = true; title.maxLength = 120; title.placeholder = "e.g. Finish networking assignment"; title.value = task?.title || "";
  titleLabel.append(title);
  const descLabel = el("label", "task-field", "Description");
  const description = el("textarea"); description.name = "description"; description.rows = 3; description.maxLength = 2000; description.placeholder = "Add details, notes, or the next action…"; description.value = task?.description || "";
  descLabel.append(description);
  const fields = el("div", "task-form-grid");
  const dueLabel = el("label", "task-field", "Due date"); const due = el("input"); due.type = "date"; due.name = "dueDate"; due.value = task?.dueDate || ""; dueLabel.append(due);
  const priorityLabel = el("label", "task-field", "Priority"); const priority = el("select"); priority.name = "priority";
  priorities.forEach(value => { const option = el("option", "", priorityLabels[value]); option.value = value; priority.append(option); }); priority.value = task?.priority || "medium"; priorityLabel.append(priority);
  const statusLabel = el("label", "task-field", "Status"); const status = el("select"); status.name = "status";
  statuses.forEach(value => { const option = el("option", "", statusLabels[value]); option.value = value; status.append(option); }); status.value = task?.status || "todo"; statusLabel.append(status);
  fields.append(dueLabel, priorityLabel, statusLabel);
  const error = el("p", "task-form-error"); error.hidden = true; error.setAttribute("role", "alert");
  const actions = el("div", "task-form-actions");
  const cancel = el("button", "button button-secondary", "Cancel"); cancel.type = "button";
  const submit = el("button", "button button-primary", task ? "Save changes" : "Create task"); submit.type = "submit";
  actions.append(cancel, submit);
  form.append(heading, titleLabel, descLabel, fields, error, actions); dialog.append(form); document.body.append(dialog);
  const closeDialog = () => { dialog.close(); dialog.remove(); };
  close.addEventListener("click", closeDialog); cancel.addEventListener("click", closeDialog);
  dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const cleanTitle = title.value.trim();
    if (!cleanTitle) { error.textContent = "Please enter a task title."; error.hidden = false; title.focus(); return; }
    submit.disabled = true; submit.textContent = "Saving…";
    try {
      const now = new Date().toISOString();
      const record = { id: task?.id || crypto.randomUUID(), userId: currentUserId, title: cleanTitle, description: description.value.trim(), dueDate: due.value, priority: priority.value, status: status.value, createdAt: task?.createdAt || now, updatedAt: now };
      await saveTask(record);
      await refresh(); closeDialog(); showToast(task ? "Task updated." : "Task created.", "success"); onChanged();
    } catch (cause) {
      error.textContent = cause instanceof Error ? `Could not save this task: ${cause.message}` : "Could not save this task. Please try again.";
      error.hidden = false; submit.disabled = false; submit.textContent = task ? "Save changes" : "Create task";
    }
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal(); title.focus();
}

function confirmTaskDeletion(task) {
  return new Promise(resolve => {
    const dialog = el("dialog", "task-dialog task-confirm-dialog");
    dialog.setAttribute("aria-labelledby", "delete-dialog-title");
    const content = el("div", "task-form");
    const heading = el("div", "task-dialog-heading");
    const title = el("h2", "", "Delete this task?");
    title.id = "delete-dialog-title";
    heading.append(title, el("p", "", "This action cannot be undone."));
    const taskName = el("p", "task-confirm-name", task.title);
    const actions = el("div", "task-form-actions");
    const cancel = el("button", "button button-secondary", "Cancel");
    cancel.type = "button";
    const confirm = el("button", "button button-primary danger-confirm-button", "Delete task");
    confirm.type = "button";
    actions.append(cancel, confirm);
    content.append(heading, taskName, actions);
    dialog.append(content);
    document.body.append(dialog);
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
    dialog.addEventListener("click", event => { if (event.target === dialog) finish(false); });
    dialog.addEventListener("close", () => { if (!settled) finish(false); }, { once: true });
    dialog.showModal();
    cancel.focus();
  });
}

async function removeTask(task) {
  const confirmed = await confirmTaskDeletion(task);
  if (!confirmed) {
    showToast("Deletion cancelled. Your task is still saved.", "info");
    return;
  }
  try { await deleteTask(task.id); await refresh(); showToast("Task deleted.", "success"); onChanged(); }
  catch (error) { showToast(error instanceof Error ? `Could not delete task: ${error.message}` : "Could not delete task.", "error"); }
}
async function toggleComplete(task) {
  try { await saveTask({ ...task, status: task.status === "completed" ? "todo" : "completed", updatedAt: new Date().toISOString() }); await refresh(); showToast(task.status === "completed" ? "Task reopened." : "Task completed.", "success"); onChanged(); }
  catch (error) { showToast(error instanceof Error ? `Could not update task: ${error.message}` : "Could not update task.", "error"); }
}
function makeSelect(labelText, name, options, value, onChange) {
  const label = el("label", "task-filter-field", labelText);
  const select = el("select", "task-filter-select"); select.name = name;
  options.forEach(([optionValue, text]) => { const option = el("option", "", text); option.value = optionValue; select.append(option); });
  select.value = value; select.addEventListener("change", () => { onChange(select.value); render(); }); label.append(select); return label;
}
function render() {
  if (!container) return;
  const section = el("section", "tasks-page");
  const toolbar = el("div", "tasks-toolbar");
  const intro = el("div", "tasks-intro"); intro.append(el("h2", "", "Your tasks"), el("p", "", `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} saved in this account`));
  const add = el("button", "button button-primary", "+ New task"); add.type = "button"; add.addEventListener("click", () => openTaskDialog()); toolbar.append(intro, add); section.append(toolbar);
  if (!tasks.length) {
    const empty = el("div", "tasks-empty"); const mark = el("div", "tasks-empty-mark", "✓"); empty.append(mark, el("h3", "", "Start with one small task"), el("p", "", "Add a task, set a due date, and track it until it's done."));
    const create = el("button", "button button-primary", "Create your first task"); create.type = "button"; create.addEventListener("click", () => openTaskDialog()); empty.append(create); section.append(empty);
  } else {
    const filters = el("div", "task-filters");
    const searchLabel = el("label", "task-filter-field task-filter-search", "Search tasks");
    const search = el("input", "task-filter-input"); search.type = "search"; search.placeholder = "Title or description…"; search.value = listFilters.query; search.setAttribute("aria-label", "Search tasks by title or description");
    search.addEventListener("input", () => { listFilters.query = search.value; const position = search.selectionStart; render(); const next = container.querySelector(".task-filter-search input"); next?.focus(); next?.setSelectionRange(position, position); });
    searchLabel.append(search);
    filters.append(searchLabel,
      makeSelect("Status", "status", [["all","All statuses"],["todo","To do"],["in-progress","In progress"],["completed","Completed"]], listFilters.status, v => listFilters.status = v),
      makeSelect("Priority", "priority", [["all","All priorities"],["high","High"],["medium","Medium"],["low","Low"]], listFilters.priority, v => listFilters.priority = v),
      makeSelect("Sort by", "sort", [["due","Due date"],["updated","Recently updated"],["created","Recently created"],["title","Title A–Z"],["priority","Priority"]], listFilters.sort, v => listFilters.sort = v));
    const clear = el("button", "button button-secondary button-small", "Clear filters"); clear.type = "button"; clear.addEventListener("click", () => { listFilters = { query: "", status: "all", priority: "all", sort: "due" }; render(); }); filters.append(clear); section.append(filters);
    const q = listFilters.query.trim().toLocaleLowerCase();
    const filtered = tasks.filter(task => (!q || `${task.title} ${task.description || ""}`.toLocaleLowerCase().includes(q)) && (listFilters.status === "all" || task.status === listFilters.status) && (listFilters.priority === "all" || task.priority === listFilters.priority));
    const priorityRank = { high: 0, medium: 1, low: 2 };
    filtered.sort((a,b) => listFilters.sort === "title" ? a.title.localeCompare(b.title) : listFilters.sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : listFilters.sort === "created" ? b.createdAt.localeCompare(a.createdAt) : listFilters.sort === "priority" ? priorityRank[a.priority] - priorityRank[b.priority] : (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
    section.append(el("p", "task-results-count", `Showing ${filtered.length} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`));
    if (!filtered.length) { const empty = el("div", "tasks-empty tasks-filter-empty"); empty.append(el("h3", "", "No matching tasks"), el("p", "", "Try changing your search or filters.")); section.append(empty); }
    else {
      const list = el("div", "task-list");
      filtered.forEach(task => {
        const card = el("article", `task-card${task.status === "completed" ? " is-completed" : ""}`);
        const check = el("button", `task-complete${task.status === "completed" ? " is-checked" : ""}`, task.status === "completed" ? "✓" : ""); check.type = "button"; check.setAttribute("aria-label", task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`); check.addEventListener("click", () => toggleComplete(task));
        const body = el("div", "task-card-body"); body.append(el("h3", "", task.title));
        if (task.description) body.append(el("p", "task-description", task.description));
        const meta = el("div", "task-meta"); meta.append(el("span", `task-chip status-${task.status}`, statusLabels[task.status]), el("span", `task-chip priority-${task.priority}`, `${priorityLabels[task.priority]} priority`));
        meta.append(el("span", `task-due${isOverdue(task) ? " is-overdue" : ""}`, `${isOverdue(task) ? "Overdue · " : "Due · "}${dateLabel(task.dueDate)}`)); body.append(meta);
        const actions = el("div", "task-card-actions"); const edit = el("button", "button button-secondary button-small", "Edit"); edit.type = "button"; edit.addEventListener("click", () => openTaskDialog(task)); const del = el("button", "button button-secondary button-small danger-button", "Delete"); del.type = "button"; del.addEventListener("click", () => removeTask(task)); actions.append(edit, del); card.append(check, body, actions); list.append(card);
      }); section.append(list);
    }
  }
  container.replaceChildren(section);
}
async function refresh() { await loadTasks(currentUserId); render(); }
export async function renderTasksView(target, userId, changed = () => {}) { container = target; onChanged = changed; await loadTasks(userId); render(); }
export async function openNewTask() { if (!currentUserId) { showToast("Sign in before creating tasks.", "error"); return; } openTaskDialog(); }
