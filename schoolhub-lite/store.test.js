const test = require('node:test');
const assert = require('node:assert');
const { Store, letterGrade, STORAGE_KEY } = require('./store.js');

function memoryStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

function seeded() {
  const store = new Store(memoryStorage());
  const ada = store.addStudent({ name: 'Ada' });
  const bob = store.addStudent({ name: 'Bob' });
  const math = store.addCourse({ code: 'math101', title: 'Algebra' });
  store.enroll(ada.id, math.id);
  store.enroll(bob.id, math.id);
  return { store, ada, bob, math };
}

test('letterGrade boundaries', () => {
  assert.deepStrictEqual([100, 90, 89.9, 80, 70, 60, 59].map(letterGrade), ['A', 'A', 'B', 'B', 'C', 'D', 'F']);
});

test('course codes are uppercased and unique', () => {
  const { store } = seeded();
  assert.strictEqual(store.state.courses[0].code, 'MATH101');
  assert.throws(() => store.addCourse({ code: 'Math101', title: 'Dup' }), /already exists/);
});

test('grades require enrollment and a valid score', () => {
  const { store, ada, math } = seeded();
  const other = store.addCourse({ code: 'BIO', title: 'Biology' });
  assert.throws(() => store.addGrade({ studentId: ada.id, courseId: other.id, label: 'Q', score: 50 }), /not enrolled/);
  assert.throws(() => store.addGrade({ studentId: ada.id, courseId: math.id, label: 'Q', score: 101 }), /between/);
  store.addGrade({ studentId: ada.id, courseId: math.id, label: 'Q1', score: 80 });
  store.addGrade({ studentId: ada.id, courseId: math.id, label: 'Q2', score: '90' });
  assert.strictEqual(store.studentAverage(ada.id), 85);
});

test('summary ranks students and computes attendance rate', () => {
  const { store, ada, bob, math } = seeded();
  store.addGrade({ studentId: ada.id, courseId: math.id, label: 'Q', score: 70 });
  store.addGrade({ studentId: bob.id, courseId: math.id, label: 'Q', score: 95 });
  store.setAttendance(math.id, '2026-10-01', ada.id, 'present');
  store.setAttendance(math.id, '2026-10-01', bob.id, 'absent');
  store.setAttendance(math.id, '2026-10-01', bob.id, 'late'); // overwrite
  const s = store.summary();
  assert.strictEqual(s.students, 2);
  assert.strictEqual(s.average, 82.5);
  assert.strictEqual(s.attendanceRate, 1);
  assert.deepStrictEqual(s.topStudents.map((r) => r.student.name), ['Bob', 'Ada']);
  assert.strictEqual(store.state.attendance.length, 2);
});

test('removing a student cascades to their records', () => {
  const { store, ada, math } = seeded();
  store.addGrade({ studentId: ada.id, courseId: math.id, label: 'Q', score: 70 });
  store.setAttendance(math.id, '2026-10-01', ada.id, 'present');
  store.removeStudent(ada.id);
  assert.strictEqual(store.state.grades.length, 0);
  assert.strictEqual(store.state.attendance.length, 0);
  assert.strictEqual(store.studentsInCourse(math.id).length, 1);
});

test('state persists and round-trips through export/import', () => {
  const storage = memoryStorage();
  const a = new Store(storage);
  a.addStudent({ name: 'Ada' });
  assert.ok(storage.getItem(STORAGE_KEY));
  assert.strictEqual(new Store(storage).state.students[0].name, 'Ada');

  const b = new Store(memoryStorage());
  b.importJSON(a.exportJSON());
  assert.strictEqual(b.state.students.length, 1);
  assert.throws(() => b.importJSON('{"foo":1}'), /Not a SchoolHub/);
});

test('corrupt storage falls back to empty state', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  assert.deepStrictEqual(new Store(storage).state.students, []);
});
