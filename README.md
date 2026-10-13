# TaskManager v2 — Stage 4

Stage 4 adds task-list productivity tools on top of the tested Stage 3 project.

## New in this stage
- Search saved tasks by title or description.
- Filter by status (To do, In progress, Completed).
- Filter by priority (High, Medium, Low).
- Sort by due date, recently updated, recently created, title, or priority.
- Clear all filters and see the number of matching tasks.
- Responsive filter controls for smaller screens.
- Keeps the Stage 3 local IndexedDB data model and account separation.
- Keeps the custom deletion confirmation dialog: cancel must preserve the task.

## Run locally
1. Extract the ZIP into a new folder.
2. Open the extracted folder in VS Code.
3. Open a terminal in this folder and run `py -m http.server 8000`.
4. Visit `http://localhost:8000`.
5. Sign in using the same browser profile and local address used for Stage 3 to access the existing local database.

If port 8000 is already serving another project folder, stop that server with `Ctrl+C` and start it from this Stage 4 folder. Do not clear site storage; Stage 3 data is stored in IndexedDB.

## Stage 4 test checklist
- [ ] Existing tasks load with the correct account.
- [ ] Search matches task titles and descriptions (case-insensitive).
- [ ] Status filter shows only the selected status.
- [ ] Priority filter shows only the selected priority.
- [ ] Each sort option changes the order as expected.
- [ ] Clear filters resets search, status, priority, and sort.
- [ ] No-match results show a helpful empty state.
- [ ] Create, edit, complete/reopen, and delete still work.
- [ ] Cancel deletion keeps the task, including after refresh.
- [ ] Confirm deletion removes the task, including after refresh.
- [ ] Mobile-width layout remains usable.

## Scope
Dashboard analytics, Kanban, interactive calendar, and data backup/settings remain later stages. Authentication is browser-only and intended for a local demo, not production security.
