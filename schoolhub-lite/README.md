# SchoolHub Lite

A small school management app that runs entirely in the browser. It has no build step, no dependencies and no server.

## Features

- **Students**: add, search and remove students (name, email, class).
- **Courses**: create courses with a unique code, and enroll or unenroll students.
- **Grades**: record assessment scores (0–100) for enrolled students. Each score also shows a letter grade (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below that).
- **Attendance**: mark each student Present, Late or Absent for each course and date.
- **Dashboard**: totals, overall average, attendance rate (Late counts as attended) and the top 5 students.
- **Data**: saved in the browser's `localStorage`. You can export or import it as JSON, or reset everything.

## Run

Open `index.html` in a browser, or serve the folder:

```sh
npx serve schoolhub-lite
```

## Test

The data layer (`store.js`) has no DOM code and is tested with Node's built-in test runner:

```sh
node --test schoolhub-lite/
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout and tabs |
| `styles.css` | Styles (light and dark mode, mobile-friendly) |
| `store.js` | Data model, validation, persistence |
| `app.js` | Rendering and event handling |
| `store.test.js` | Unit tests for `store.js` |
