/*
  Task Record & Reminder - Application Logic
  Author: NirmalyaLenka
  Description: Handles all runtime behaviour including task CRUD,
               localStorage persistence, browser notification scheduling,
               activity log management, filtering, sorting, and toast
               feedback. No external dependencies - plain vanilla JS.
*/

"use strict";

// ─── Configuration ────────────────────────────────────────────────────────────

const STORAGE_KEY     = "minimalTaskReminder.tasks.v1";
const LOG_KEY         = "minimalTaskReminder.logs.v1";
const REMINDER_MINUTES = 30;   // Minutes before due time to send a reminder
const MAX_LOGS        = 80;    // Maximum activity log entries to keep in memory
const LOG_DISPLAY     = 30;    // Maximum log entries shown in the sidebar

// ─── DOM references ───────────────────────────────────────────────────────────

const els = {
  form:               document.getElementById("taskForm"),
  formTitle:          document.getElementById("formTitle"),
  taskId:             document.getElementById("taskId"),
  taskName:           document.getElementById("taskName"),
  dueDate:            document.getElementById("dueDate"),
  dueTime:            document.getElementById("dueTime"),
  priority:           document.getElementById("priority"),
  assignedBy:         document.getElementById("assignedBy"),
  taskNote:           document.getElementById("taskNote"),
  resetBtn:           document.getElementById("resetBtn"),
  saveBtn:            document.getElementById("saveBtn"),
  notificationStatus: document.getElementById("notificationStatus"),
  taskList:           document.getElementById("taskList"),
  activityLog:        document.getElementById("activityLog"),
  totalCount:         document.getElementById("totalCount"),
  completedCount:     document.getElementById("completedCount"),
  pendingCount:       document.getElementById("pendingCount"),
  overdueCount:       document.getElementById("overdueCount"),
  searchInput:        document.getElementById("searchInput"),
  sortOrder:          document.getElementById("sortOrder"),
  exportBtn:          document.getElementById("exportBtn"),
  clearBtn:           document.getElementById("clearBtn"),
  toast:              document.getElementById("toast")
};

// ─── Application state ────────────────────────────────────────────────────────

let tasks         = loadFromStorage(STORAGE_KEY, []);
let logs          = loadFromStorage(LOG_KEY, []);
let currentFilter = "all";

const priorityRank = { Low: 1, Normal: 2, High: 3 };

// ─── Storage helpers ─────────────────────────────────────────────────────────

/**
 * Read and parse a JSON value from localStorage.
 * Returns `fallback` when the key is absent or the value is malformed.
 */
function loadFromStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

/** Write the current tasks and logs back to localStorage. */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  localStorage.setItem(LOG_KEY,     JSON.stringify(logs));
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Generate a short unique ID using timestamp + random characters. */
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Combine a date string and time string into an ISO 8601 timestamp. */
function dueIso(date, time) {
  return new Date(`${date}T${time}`).toISOString();
}

/** Format an ISO timestamp to a human-readable locale string. */
function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

/** Return the number of minutes between now and a given ISO timestamp. */
function minutesUntil(value) {
  return Math.round((new Date(value).getTime() - Date.now()) / 60000);
}

/** Returns true when a pending task has passed its due date/time. */
function isOverdue(task) {
  return task.status === "pending" && new Date(task.dueAt).getTime() < Date.now();
}

/**
 * Escape characters that would break HTML rendering.
 * Called whenever user-entered text is written into innerHTML.
 */
function escapeHtml(text = "") {
  return text.replace(/[&<>'"]/g, char => ({
    "&":  "&amp;",
    "<":  "&lt;",
    ">":  "&gt;",
    "'":  "&#039;",
    '"':  "&quot;"
  })[char]);
}

// ─── Activity log ─────────────────────────────────────────────────────────────

/** Prepend a timestamped message to the activity log, then persist and re-render. */
function addLog(message) {
  logs.unshift({ id: createId(), message, at: new Date().toISOString() });
  logs = logs.slice(0, MAX_LOGS);
  save();
  renderLogs();
}

// ─── Toast feedback ───────────────────────────────────────────────────────────

/** Show a short-lived status message at the bottom of the viewport. */
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.remove("show"), 3200);
}

// ─── Browser notifications ────────────────────────────────────────────────────

/**
 * Ask the user for notification permission on first task save.
 * Does nothing if permission has already been granted or denied.
 */
async function requestNotifications() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* browser declined silently */ }
  }
  updateNotificationStatus();
  return Notification.permission;
}

/** Refresh the status hint text shown below the form submit button. */
function updateNotificationStatus() {
  const el = els.notificationStatus;
  if (!("Notification" in window)) {
    el.textContent = "Notifications are not supported in this browser.";
  } else if (Notification.permission === "granted") {
    el.innerHTML =
      "Notifications are allowed. You will be reminded <strong>30 minutes before</strong> pending task deadlines while this page is open.";
  } else if (Notification.permission === "denied") {
    el.textContent =
      "Notifications are blocked. Allow them from your browser settings to receive reminders.";
  } else {
    el.innerHTML =
      'Click <strong>Save task</strong> or your browser permission prompt to allow reminders 30 minutes before deadlines.';
  }
}

/**
 * Fire a browser notification and an in-page toast for a single task.
 * Marks the task as reminded so it will not fire again.
 */
function sendBrowserNotification(task) {
  const body = `Due at ${formatDate(task.dueAt)}${task.note ? " — " + task.note.slice(0, 90) : ""}`;

  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(`Reminder: ${task.name}`, {
      body,
      tag: task.id,
      requireInteraction: false
    });
    notification.onclick = () => window.focus();
  }

  showToast(`Reminder: "${task.name}" is due in about ${REMINDER_MINUTES} minutes.`);
  task.remindedAt = new Date().toISOString();
  addLog(`Reminder sent for "${task.name}".`);
  save();
  render();
}

/**
 * Walk all pending tasks and fire a reminder for any that fall inside the
 * 30-minute window before their due time and have not yet been reminded.
 * Called on page load and every 30 seconds via setInterval.
 */
function checkReminders() {
  const now = Date.now();
  tasks.forEach(task => {
    if (task.status !== "pending" || task.remindedAt) return;
    const due          = new Date(task.dueAt).getTime();
    const reminderTime = due - REMINDER_MINUTES * 60 * 1000;
    if (now >= reminderTime && now < due) {
      sendBrowserNotification(task);
    }
  });
  renderStats();
}

// ─── Filtering and sorting ────────────────────────────────────────────────────

/**
 * Return the subset of tasks that match the active filter button and the
 * current search query, sorted according to the sort dropdown selection.
 */
function getFilteredTasks() {
  const query     = els.searchInput.value.trim().toLowerCase();
  const sortOrder = els.sortOrder ? els.sortOrder.value : "lowHigh";

  const statusRank = task => {
    if (task.status === "pending")   return 0;
    if (task.status === "completed") return 1;
    return 2;
  };

  return tasks
    .filter(task => {
      if (currentFilter === "pending"   && task.status !== "pending")   return false;
      if (currentFilter === "completed" && task.status !== "completed") return false;
      if (currentFilter === "archived"  && task.status !== "archived")  return false;
      if (currentFilter === "overdue"   && !isOverdue(task))            return false;

      if (query) {
        const haystack = [
          task.name, task.note, task.priority, task.assignedBy, task.status
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      const statusCompare = statusRank(a) - statusRank(b);
      if (statusCompare !== 0 && currentFilter === "all") return statusCompare;

      const rankA      = priorityRank[a.priority] || 2;
      const rankB      = priorityRank[b.priority] || 2;
      const dueCompare = new Date(a.dueAt) - new Date(b.dueAt);

      if (sortOrder === "highLow") return (rankB - rankA) || dueCompare;
      if (sortOrder === "due")     return dueCompare || (rankB - rankA);
      return (rankA - rankB) || dueCompare;
    });
}

// ─── Chip helpers ─────────────────────────────────────────────────────────────

/** Return a CSS class name for the priority chip colour. */
function priorityChip(priority) {
  if (priority === "High") return "danger";
  if (priority === "Low")  return "";
  return "warning";
}

/** Return a coloured chip element based on the task's current status. */
function statusChip(task) {
  if (task.status === "completed") return `<span class="chip success">Completed</span>`;
  if (task.status === "archived")  return `<span class="chip">Archived</span>`;
  if (isOverdue(task))             return `<span class="chip danger">Overdue</span>`;

  const mins = minutesUntil(task.dueAt);
  if (mins <= REMINDER_MINUTES && mins >= 0) return `<span class="chip warning">Due soon</span>`;
  return `<span class="chip">Pending</span>`;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/** Re-draw the full task table from the current filter state. */
function renderTasks() {
  const visibleTasks = getFilteredTasks();

  if (!visibleTasks.length) {
    els.taskList.innerHTML = `<div class="empty">No tasks found. Add a task or change the filter.</div>`;
    return;
  }

  const sortLabel =
    els.sortOrder && els.sortOrder.value === "highLow" ? "more important to less important" :
    els.sortOrder && els.sortOrder.value === "due"     ? "earliest due date first" :
    "less important to more important";

  const rows = visibleTasks.map((task, index) => {
    const overdueClass   = isOverdue(task)            ? "overdue"   : "";
    const completedClass = task.status === "completed" ? "completed" : "";
    const archivedClass  = task.status === "archived"  ? "archived"  : "";

    const recordLines = [
      `Created: ${formatDate(task.createdAt)}`,
      task.completedAt ? `Completed: ${formatDate(task.completedAt)}` : "",
      task.archivedAt  ? `Archived: ${formatDate(task.archivedAt)}`   : "",
      task.remindedAt  ? `Reminder: ${formatDate(task.remindedAt)}`   : ""
    ].filter(Boolean).join("<br>");

    return `
      <tr class="task-row ${overdueClass} ${completedClass} ${archivedClass}" data-id="${task.id}">
        <td class="row-index">${String(index + 1).padStart(2, "0")}</td>
        <td>
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-subline">Saved record stays in this browser</div>
        </td>
        <td><span class="chip ${priorityChip(task.priority)}">${escapeHtml(task.priority)} priority</span></td>
        <td>${statusChip(task)}</td>
        <td class="date-cell">${formatDate(task.dueAt)}</td>
        <td class="assigned-cell">${task.assignedBy ? escapeHtml(task.assignedBy) : "—"}</td>
        <td class="record-cell">${recordLines}</td>
        <td class="note-cell">${task.note ? escapeHtml(task.note) : "—"}</td>
        <td>
          <div class="task-actions">
            ${task.status !== "completed" && task.status !== "archived"
              ? `<button class="small-btn btn-success" data-action="complete" type="button">Done</button>`
              : ""}
            ${task.status === "completed"
              ? `<button class="small-btn btn-secondary" data-action="reopen" type="button">Reopen</button>`
              : ""}
            ${task.status !== "archived"
              ? `<button class="small-btn btn-secondary" data-action="edit" type="button">Edit</button>`
              : ""}
            ${task.status === "archived"
              ? `<button class="small-btn btn-secondary" data-action="restore" type="button">Restore</button>`
              : `<button class="small-btn btn-danger" data-action="archive" type="button">Archive</button>`}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  els.taskList.innerHTML = `
    <div class="sheet-wrap" role="region" aria-label="Organized task sheet" tabindex="0">
      <div class="sheet-title">
        <span>Task sheet view</span>
        <span>Ordered by ${sortLabel}</span>
      </div>
      <table class="task-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Task</th>
            <th>Importance</th>
            <th>Status</th>
            <th>Due date</th>
            <th>Assigned / source</th>
            <th>Record</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/** Recalculate and update the four stat counters at the top. */
function renderStats() {
  const activeTasks = tasks.filter(t => t.status !== "archived");
  els.totalCount.textContent     = activeTasks.length;
  els.completedCount.textContent = activeTasks.filter(t => t.status === "completed").length;
  els.pendingCount.textContent   = activeTasks.filter(t => t.status === "pending").length;
  els.overdueCount.textContent   = activeTasks.filter(isOverdue).length;
}

/** Re-draw the sidebar activity log. */
function renderLogs() {
  if (!logs.length) {
    els.activityLog.innerHTML = `<div class="empty" style="padding: 22px 12px;">No activity yet.</div>`;
    return;
  }
  els.activityLog.innerHTML = logs.slice(0, LOG_DISPLAY).map(log => `
    <div class="log-item">
      <strong>${escapeHtml(log.message)}</strong><br>
      ${formatDate(log.at)}
    </div>
  `).join("");
}

/** Run all three render functions together. */
function render() {
  renderTasks();
  renderStats();
  renderLogs();
  updateNotificationStatus();
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

/** Clear the form and return it to its default "add new task" state. */
function resetForm() {
  els.form.reset();
  els.taskId.value    = "";
  els.formTitle.textContent = "Add a new task";
  els.saveBtn.textContent   = "Save task";
  setDefaultDateTime();
}

/** Pre-fill the due date/time fields to one hour from now. */
function setDefaultDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  const pad = n => String(n).padStart(2, "0");
  els.dueDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  els.dueTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

/** Handle new task creation and existing task editing on form submit. */
els.form.addEventListener("submit", async event => {
  event.preventDefault();
  await requestNotifications();

  const dueAt     = dueIso(els.dueDate.value, els.dueTime.value);
  const editingId = els.taskId.value;
  const payload   = {
    name:       els.taskName.value.trim(),
    dueAt,
    priority:   els.priority.value,
    assignedBy: els.assignedBy.value.trim(),
    note:       els.taskNote.value.trim()
  };

  if (!payload.name) return;

  if (editingId) {
    // ── Editing an existing task ──
    const task = tasks.find(item => item.id === editingId);
    if (!task) return;

    Object.assign(task, payload, { updatedAt: new Date().toISOString() });

    // Reset reminder flag if the new due time is far enough in the future.
    if (new Date(task.dueAt).getTime() - REMINDER_MINUTES * 60000 > Date.now()) {
      task.remindedAt = null;
    }

    addLog(`Updated "${task.name}".`);
    showToast("Task updated.");
  } else {
    // ── Creating a new task ──
    const task = {
      id:          createId(),
      ...payload,
      status:      "pending",
      createdAt:   new Date().toISOString(),
      updatedAt:   null,
      completedAt: null,
      archivedAt:  null,
      remindedAt:  null
    };
    tasks.unshift(task);
    addLog(`Created "${task.name}".`);
    showToast("Task saved. Reminder is set for 30 minutes before the due time.");
  }

  save();
  resetForm();
  render();
  checkReminders();
});

/** Reset the form when the Reset button is clicked. */
els.resetBtn.addEventListener("click", resetForm);

/** Handle filter button clicks. */
document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

/** Live search re-render on keystroke. */
els.searchInput.addEventListener("input", renderTasks);

/** Sort order change re-render. */
els.sortOrder.addEventListener("change", renderTasks);

/** Delegated click handler for all task row action buttons. */
els.taskList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row  = button.closest(".task-row");
  const task = tasks.find(item => item.id === row.dataset.id);
  if (!task) return;

  const action = button.dataset.action;

  if (action === "complete") {
    task.status      = "completed";
    task.completedAt = new Date().toISOString();
    addLog(`Completed "${task.name}".`);
    showToast("Task marked as completed.");
  }

  if (action === "reopen") {
    task.status      = "pending";
    task.completedAt = null;
    if (new Date(task.dueAt).getTime() - REMINDER_MINUTES * 60000 > Date.now()) {
      task.remindedAt = null;
    }
    addLog(`Reopened "${task.name}".`);
    showToast("Task reopened.");
  }

  if (action === "edit") {
    els.taskId.value    = task.id;
    els.taskName.value  = task.name;
    const due = new Date(task.dueAt);
    const pad = n => String(n).padStart(2, "0");
    els.dueDate.value  = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
    els.dueTime.value  = `${pad(due.getHours())}:${pad(due.getMinutes())}`;
    els.priority.value = task.priority;
    els.assignedBy.value = task.assignedBy || "";
    els.taskNote.value = task.note || "";
    els.formTitle.textContent = "Edit task";
    els.saveBtn.textContent   = "Update task";
    els.taskName.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return; // Skip save/render below — no data changed yet.
  }

  if (action === "archive") {
    task.status     = "archived";
    task.archivedAt = new Date().toISOString();
    addLog(`Archived "${task.name}".`);
    showToast("Task archived. It remains in your records.");
  }

  if (action === "restore") {
    task.status     = "pending";
    task.archivedAt = null;
    addLog(`Restored "${task.name}".`);
    showToast("Task restored to pending.");
  }

  save();
  render();
});

/** Export all tasks and logs as a dated JSON file. */
els.exportBtn.addEventListener("click", () => {
  const data = {
    exportedAt:      new Date().toISOString(),
    reminderMinutes: REMINDER_MINUTES,
    tasks,
    activityLog: logs
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `task-records-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Records exported as JSON.");
});

/** Clear all tasks and logs after explicit user confirmation. */
els.clearBtn.addEventListener("click", () => {
  const confirmed = confirm(
    "Clear all tasks and activity records from this browser? This cannot be undone."
  );
  if (!confirmed) return;
  tasks = [];
  logs  = [];
  save();
  resetForm();
  render();
  showToast("All records cleared.");
});

// ─── Initialisation ───────────────────────────────────────────────────────────

updateNotificationStatus();
setDefaultDateTime();
render();
checkReminders();

// Poll for due reminders every 30 seconds while the page is open.
setInterval(checkReminders, 30000);
