# Task Record & Reminder

A single-page task manager written in HTML, CSS, and vanilla JavaScript. The intended features are task creation and editing, deadlines, priorities, status filters, search/sorting, an activity log, JSON export, and browser notifications 30 minutes before due times.

## Important: current file-path blocker

The checked-in `index.html` references `src/styles.css` and `src/app.js`, but the tracked files are at the repository root as `styles.css` and `app.js`. The referenced `src/` files were not found during this review. As committed, the page therefore cannot load its stylesheet and application logic from those paths. **Do not assume the app is working until this path mismatch is corrected.** The application files were left unchanged as required.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page markup and controls; currently references missing `src/` asset paths |
| `styles.css` | Stylesheet present at the repository root |
| `app.js` | Application logic present at the repository root |
| `LICENSE` | MIT license |
| `README.md` | Setup notes, limitations, and maintenance record |

## Run and inspect

There is no package manifest, build step, or third-party JavaScript dependency. The path mismatch above must be fixed in a future code change before the app can run as intended. Once the HTML references point to the tracked root files, start a local server from the repository root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in a modern browser. Use the browser developer tools' Network/Console panels to check that `styles.css` and `app.js` load successfully. Opening `index.html` directly does not resolve the current missing paths.

## Data and reminders

- Tasks and activity entries are stored in this browser's `localStorage` under `minimalTaskReminder.tasks.v1` and `minimalTaskReminder.logs.v1`.
- Use **Export records** to save a JSON backup before clearing browser data or using **Clear all**.
- The reminder window is configured in `app.js` as `REMINDER_MINUTES = 30`.
- The script checks deadlines on page load and every 30 seconds. Keep the page open; browser throttling, sleep, or closed tabs can delay or prevent reminders. This is not a reliable background alarm service.
- Browser notifications require support and permission from the user. Denied permission prevents notification delivery.
- Records are local to the browser profile; they are not synced to a server or another device.

## First-run checklist

1. Resolve the HTML-to-file path mismatch before evaluating the app.
2. Run it only in a browser profile where you are comfortable storing task details locally.
3. Grant notification permission only if you want browser reminders.
4. Create a test task with a near-future due time and confirm behavior manually; no runtime test was performed during this documentation review.
5. Export records before using **Clear all** or clearing site data.

## Browser APIs and implementation

The source uses `localStorage`, the Notifications API, `Intl.DateTimeFormat`, and browser Blob/URL APIs for JSON export. No backend is present in the reviewed files. The application logic is in `app.js`; the page markup is in `index.html`; visual styling is in `styles.css`.

## License and verification

The repository includes an MIT `LICENSE`. The source and markup were inspected, but no browser test was run. The known asset-path mismatch remains unresolved because this maintenance pass is limited to documentation and safe organization changes.

---

## Maintenance & Audit

- **Audit date:** 11 November 2026
- **Documentation status:** README reviewed and audit record added on this date.
- **Scope and evidence:** Documentation review of `index.html`, `app.js`, `styles.css`, and the existing README. The missing `src/styles.css` and `src/app.js` references were confirmed; this does not establish successful runtime behavior.
- **Code and tests:** No application code was changed and no browser or notification test was performed.
- **Maintenance baseline:** Documentation status recorded through 11 November 2026; revisit the file-path mismatch, notification timing, local-storage behavior, and export flow after code changes.
