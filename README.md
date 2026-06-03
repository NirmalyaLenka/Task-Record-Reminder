# Task-Record-Reminder
A lightweight, browser-based task manager that lives entirely in a single HTML page. No server, no database, no account — open the file and start working.

Tasks are saved in your browser's local storage and stay there between sessions. A reminder fires as a browser notification 30 minutes before each task's deadline, as long as the page remains open.

---

## What it does

- Add tasks with a name, due date and time, priority level, and an optional note
- Receive a browser notification 30 minutes before each deadline
- View tasks filtered by status — all, pending, completed, overdue, or archived
- Search tasks by name, note, priority, or assigned source
- Sort tasks by importance (low to high, high to low) or by due date
- Mark tasks as done, reopen them, edit, archive, or restore them
- See a running activity log of every action taken
- Export all tasks and log entries as a JSON file for safekeeping
- Clear everything with a single confirmation step

---

## Project structure

```
task-record-reminder/
  index.html          Main page — markup and page structure only
  src/
    styles.css        All visual styles — layout, components, responsive rules
    app.js            All application logic — storage, rendering, events, notifications
  docs/
    INSTRUCTIONS.docx Setup and usage guide in Word format
  .gitignore          Files excluded from version control
  LICENSE             MIT license
  README.md           This file
```

Each file has a single, clear responsibility. The HTML contains no inline styles or scripts. The CSS has no JavaScript. The JavaScript has no embedded HTML strings beyond what is strictly necessary to render dynamic rows.

---

## How to run

No build step is required. Open `index.html` directly in a web browser.

**Option 1 — File open (quickest)**

Double-click `index.html` or drag it into any modern browser window. The app loads immediately.

**Option 2 — Local server (recommended for development)**

If you want to avoid any browser restrictions on file:// URLs, serve the folder with a simple HTTP server:

Using Python:
```
python -m http.server 8080
```

Using Node.js (with the npx serve package):
```
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## Browser compatibility

The app uses standard, widely supported web APIs:

- `localStorage` for persistence
- `Notification` API for reminders
- `Intl.DateTimeFormat` for locale-aware date display
- `Blob` and `URL.createObjectURL` for JSON export

Any modern browser released after 2018 will work without issues. Notifications require the user to grant permission when prompted.

---

## Local storage keys

| Key | Contents |
|---|---|
| `minimalTaskReminder.tasks.v1` | Array of all task objects |
| `minimalTaskReminder.logs.v1` | Array of activity log entries |

Data never leaves the browser. No network requests are made by the application itself.

---

## Task data shape

Each task object stored in local storage has this structure:

```json
{
  "id":          "unique string",
  "name":        "Task name",
  "dueAt":       "2025-06-10T14:00:00.000Z",
  "priority":    "Low | Normal | High",
  "assignedBy":  "optional source label",
  "note":        "optional free text",
  "status":      "pending | completed | archived",
  "createdAt":   "ISO timestamp",
  "updatedAt":   "ISO timestamp or null",
  "completedAt": "ISO timestamp or null",
  "archivedAt":  "ISO timestamp or null",
  "remindedAt":  "ISO timestamp or null"
}
```

---

## Exported JSON format

Clicking "Export records" downloads a file named `task-records-YYYY-MM-DD.json` with this shape:

```json
{
  "exportedAt":      "ISO timestamp",
  "reminderMinutes": 30,
  "tasks":           [...],
  "activityLog":     [...]
}
```

---

## Customising the reminder window

The reminder fires 30 minutes before each due time by default. To change this, open `src/app.js` and edit line 14:

```js
const REMINDER_MINUTES = 30;
```

Set it to any positive integer (minutes). The change takes effect on the next page load.

---

## License

MIT. See `LICENSE` for the full text.
## contact
For any queries please contact carmodbhai@gmail.com
