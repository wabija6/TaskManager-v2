const dashboardTemplate = [...(document.querySelector("#view-content")?.children ?? [])]
  .map((element) => element.cloneNode(true));

const viewCopy = {
  dashboard: {
    heading: "Your overview, at a glance",
    description: "Live statistics, progress, and deadline summaries will use your saved tasks once the data layer is implemented."
  },
  tasks: {
    heading: "Your tasks, in one place",
    description: "Create, edit, filter, sort, and complete tasks. The task workflow is introduced in Stage 3, followed by the list tools in Stage 4."
  },
  calendar: {
    heading: "Make room for what matters",
    description: "The monthly calendar will place your tasks on their due dates and help you see what's coming next."
  },
  kanban: {
    heading: "A clearer path from start to done",
    description: "Move task cards between To Do, In Progress, and Completed, with keyboard alternatives for drag-and-drop."
  },
  settings: {
    heading: "A workspace that fits you",
    description: "Profile editing, data backup, import validation, and recovery controls will be introduced in Stage 8."
  }
};

export function renderView(container, viewName, meta) {
  if (viewName === "dashboard") {
    container.replaceChildren(...dashboardTemplate.map((element) => element.cloneNode(true)));
    return;
  }

  const content = document.createElement("section");
  content.className = "view-placeholder";

  const inner = document.createElement("div");
  inner.className = "view-placeholder-inner";

  const iconBox = document.createElement("div");
  iconBox.className = "view-placeholder-icon";
  const icon = document.createElement("span");
  icon.className = `icon ${meta.icon}`;
  icon.setAttribute("aria-hidden", "true");
  iconBox.append(icon);

  const heading = document.createElement("h2");
  heading.textContent = viewCopy[viewName].heading;
  const description = document.createElement("p");
  description.textContent = viewCopy[viewName].description;

  const label = document.createElement("span");
  label.className = "stage-label";
  label.textContent = meta.stage;

  inner.append(iconBox, heading, description, label);
  content.append(inner);
  container.replaceChildren(content);
}
