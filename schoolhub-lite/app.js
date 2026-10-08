/* SchoolHub Lite UI: renders the store into the page and wires up forms. */
(function () {
  'use strict';

  var storage = null;
  try { storage = window.localStorage; } catch (e) { /* private mode etc. */ }
  var store = new SchoolHub.Store(storage);
  var letterGrade = SchoolHub.letterGrade;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function emptyRow(cols) {
    return '<tr><td colspan="' + cols + '" class="empty">Nothing here yet.</td></tr>';
  }

  function fmt(n, digits) { return n === null ? '–' : n.toFixed(digits == null ? 1 : digits); }

  function guard(fn) {
    return function (e) {
      try { fn(e); } catch (err) { alert(err.message); }
    };
  }

  /* Tabs */
  $('#tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === btn.dataset.tab); });
    render();
  });

  /* Dashboard */
  function renderDashboard() {
    var s = store.summary();
    $('#stat-students').textContent = s.students;
    $('#stat-courses').textContent = s.courses;
    $('#stat-avg').textContent = fmt(s.average);
    $('#stat-attendance').textContent = s.attendanceRate === null ? '–' : Math.round(s.attendanceRate * 100) + '%';
    $('#top-students').innerHTML = s.topStudents.length
      ? s.topStudents.map(function (r) {
          return '<tr><td>' + esc(r.student.name) + '</td><td>' + fmt(r.average) +
            ' (' + letterGrade(r.average) + ')</td><td>' + r.count + '</td></tr>';
        }).join('')
      : emptyRow(3);
  }

  $('#export-btn').addEventListener('click', function () {
    var blob = new Blob([store.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'schoolhub-lite-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#import-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(guard(function (text) {
      store.importJSON(text);
      render();
    }));
    e.target.value = '';
  });

  $('#reset-btn').addEventListener('click', function () {
    if (confirm('Delete all students, courses, grades and attendance?')) { store.reset(); render(); }
  });

  /* Students */
  function renderStudents() {
    var q = $('#student-search').value.trim().toLowerCase();
    var list = store.state.students
      .filter(function (s) { return !q || (s.name + ' ' + s.email + ' ' + s.grade).toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    $('#student-list').innerHTML = list.length
      ? list.map(function (s) {
          var courses = store.coursesForStudent(s.id).map(function (c) { return esc(c.code); }).join(', ');
          return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.email) + '</td><td>' + esc(s.grade) +
            '</td><td>' + (courses || '–') + '</td><td><button class="link" data-remove-student="' + s.id +
            '">Remove</button></td></tr>';
        }).join('')
      : emptyRow(5);
  }

  $('#student-form').addEventListener('submit', guard(function (e) {
    e.preventDefault();
    var f = e.target;
    store.addStudent({ name: f.name.value, email: f.email.value, grade: f.grade.value });
    f.reset();
    render();
  }));
  $('#student-search').addEventListener('input', renderStudents);
  $('#student-list').addEventListener('click', function (e) {
    var id = e.target.dataset.removeStudent;
    if (id && confirm('Remove this student and all their records?')) { store.removeStudent(id); render(); }
  });

  /* Courses */
  function renderCourses() {
    var courses = store.state.courses.slice().sort(function (a, b) { return a.code.localeCompare(b.code); });
    if (!courses.length) { $('#course-list').innerHTML = '<p class="empty">No courses yet.</p>'; return; }
    $('#course-list').innerHTML = courses.map(function (c) {
      var enrolled = store.studentsInCourse(c.id);
      var available = store.state.students.filter(function (s) { return !store.isEnrolled(s.id, c.id); });
      return '<div class="card"><h3>' + esc(c.code) + ' · ' + esc(c.title) + '</h3>' +
        '<div class="meta">' + (c.teacher ? 'Teacher: ' + esc(c.teacher) + ' · ' : '') + enrolled.length + ' enrolled</div>' +
        '<ul>' + enrolled.map(function (s) {
          return '<li>' + esc(s.name) + '<button class="link" data-unenroll="' + s.id + '" data-course="' + c.id + '">×</button></li>';
        }).join('') + '</ul>' +
        (available.length
          ? '<div class="enroll"><select data-enroll-select="' + c.id + '">' +
            available.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') +
            '</select><button data-enroll="' + c.id + '">Enroll</button></div>'
          : '') +
        '<p><button class="link" data-remove-course="' + c.id + '">Delete course</button></p></div>';
    }).join('');
  }

  $('#course-form').addEventListener('submit', guard(function (e) {
    e.preventDefault();
    var f = e.target;
    store.addCourse({ code: f.code.value, title: f.title.value, teacher: f.teacher.value });
    f.reset();
    render();
  }));
  $('#course-list').addEventListener('click', guard(function (e) {
    var d = e.target.dataset;
    if (d.enroll) {
      var sel = document.querySelector('[data-enroll-select="' + d.enroll + '"]');
      store.enroll(sel.value, d.enroll);
    } else if (d.unenroll) {
      store.unenroll(d.unenroll, d.course);
    } else if (d.removeCourse) {
      if (!confirm('Delete this course with its grades and attendance?')) return;
      store.removeCourse(d.removeCourse);
    } else return;
    render();
  }));

  /* Grades */
  function fillSelect(select, items, labelFn, placeholder) {
    var prev = select.value;
    select.innerHTML = '<option value="">' + placeholder + '</option>' + items.map(function (x) {
      return '<option value="' + x.id + '">' + esc(labelFn(x)) + '</option>';
    }).join('');
    if (items.some(function (x) { return x.id === prev; })) select.value = prev;
  }

  function renderGrades() {
    var f = $('#grade-form');
    fillSelect(f.studentId, store.state.students, function (s) { return s.name; }, 'Student…');
    var courses = f.studentId.value ? store.coursesForStudent(f.studentId.value) : store.state.courses;
    fillSelect(f.courseId, courses, function (c) { return c.code + ' – ' + c.title; }, 'Course…');

    var rows = store.state.grades.slice().reverse();
    $('#grade-list').innerHTML = rows.length
      ? rows.map(function (g) {
          var s = store.getStudent(g.studentId), c = store.getCourse(g.courseId);
          return '<tr><td>' + esc(s && s.name) + '</td><td>' + esc(c && c.code) + '</td><td>' + esc(g.label) +
            '</td><td>' + g.score + '</td><td>' + letterGrade(g.score) +
            '</td><td><button class="link" data-remove-grade="' + g.id + '">Remove</button></td></tr>';
        }).join('')
      : emptyRow(6);
  }

  $('#grade-form').studentId.addEventListener('change', renderGrades);
  $('#grade-form').addEventListener('submit', guard(function (e) {
    e.preventDefault();
    var f = e.target;
    store.addGrade({ studentId: f.studentId.value, courseId: f.courseId.value, label: f.label.value, score: f.score.value });
    f.label.value = '';
    f.score.value = '';
    render();
  }));
  $('#grade-list').addEventListener('click', function (e) {
    var id = e.target.dataset.removeGrade;
    if (id) { store.removeGrade(id); render(); }
  });

  /* Attendance */
  var roster = null; // { courseId, date }

  function renderAttendance() {
    var f = $('#attendance-form');
    fillSelect(f.courseId, store.state.courses, function (c) { return c.code + ' – ' + c.title; }, 'Course…');
    if (!f.date.value) f.date.value = new Date().toISOString().slice(0, 10);

    var el = $('#roster');
    if (!roster || !store.getCourse(roster.courseId)) { el.innerHTML = ''; return; }
    var students = store.studentsInCourse(roster.courseId);
    el.innerHTML = '<table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>' +
      (students.length
        ? students.map(function (s) {
            var status = store.getAttendance(roster.courseId, roster.date, s.id);
            return '<tr><td>' + esc(s.name) + '</td><td><span class="status-group">' +
              ['present', 'late', 'absent'].map(function (st) {
                return '<button data-student="' + s.id + '" data-status="' + st + '"' +
                  (status === st ? ' class="on"' : '') + '>' + st[0].toUpperCase() + st.slice(1) + '</button>';
              }).join('') + '</span></td></tr>';
          }).join('')
        : emptyRow(2)) +
      '</tbody></table>';
  }

  $('#attendance-form').addEventListener('submit', function (e) {
    e.preventDefault();
    roster = { courseId: e.target.courseId.value, date: e.target.date.value };
    renderAttendance();
  });
  $('#roster').addEventListener('click', guard(function (e) {
    var d = e.target.dataset;
    if (!d.status || !roster) return;
    store.setAttendance(roster.courseId, roster.date, d.student, d.status);
    renderAttendance();
  }));

  function render() {
    renderDashboard();
    renderStudents();
    renderCourses();
    renderGrades();
    renderAttendance();
  }

  render();
})();
