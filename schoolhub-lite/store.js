/*
 * SchoolHub Lite data store.
 * Pure data logic with no DOM access, so it can be unit-tested under Node.
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'schoolhub-lite:v1';

  function emptyState() {
    return { students: [], courses: [], enrollments: [], grades: [], attendance: [] };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function letterGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  function average(nums) {
    if (!nums.length) return null;
    return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
  }

  function Store(storage) {
    this.storage = storage || null;
    this.state = this.load();
  }

  Store.prototype.load = function () {
    if (!this.storage) return emptyState();
    try {
      var raw = this.storage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : emptyState();
    } catch (e) {
      return emptyState();
    }
  };

  Store.prototype.save = function () {
    if (!this.storage) return;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* storage unavailable */ }
  };

  function normalize(data) {
    var s = emptyState();
    Object.keys(s).forEach(function (k) {
      if (Array.isArray(data && data[k])) s[k] = data[k];
    });
    return s;
  }

  /* Students */
  Store.prototype.addStudent = function (fields) {
    var name = (fields.name || '').trim();
    if (!name) throw new Error('Student name is required');
    var student = { id: uid(), name: name, email: (fields.email || '').trim(), grade: (fields.grade || '').trim() };
    this.state.students.push(student);
    this.save();
    return student;
  };

  Store.prototype.removeStudent = function (id) {
    var s = this.state;
    s.students = s.students.filter(function (x) { return x.id !== id; });
    s.enrollments = s.enrollments.filter(function (x) { return x.studentId !== id; });
    s.grades = s.grades.filter(function (x) { return x.studentId !== id; });
    s.attendance = s.attendance.filter(function (x) { return x.studentId !== id; });
    this.save();
  };

  Store.prototype.getStudent = function (id) {
    return this.state.students.find(function (x) { return x.id === id; }) || null;
  };

  /* Courses */
  Store.prototype.addCourse = function (fields) {
    var code = (fields.code || '').trim().toUpperCase();
    var title = (fields.title || '').trim();
    if (!code || !title) throw new Error('Course code and title are required');
    if (this.state.courses.some(function (c) { return c.code === code; })) {
      throw new Error('A course with code ' + code + ' already exists');
    }
    var course = { id: uid(), code: code, title: title, teacher: (fields.teacher || '').trim() };
    this.state.courses.push(course);
    this.save();
    return course;
  };

  Store.prototype.removeCourse = function (id) {
    var s = this.state;
    s.courses = s.courses.filter(function (x) { return x.id !== id; });
    s.enrollments = s.enrollments.filter(function (x) { return x.courseId !== id; });
    s.grades = s.grades.filter(function (x) { return x.courseId !== id; });
    s.attendance = s.attendance.filter(function (x) { return x.courseId !== id; });
    this.save();
  };

  Store.prototype.getCourse = function (id) {
    return this.state.courses.find(function (x) { return x.id === id; }) || null;
  };

  /* Enrollments */
  Store.prototype.isEnrolled = function (studentId, courseId) {
    return this.state.enrollments.some(function (e) {
      return e.studentId === studentId && e.courseId === courseId;
    });
  };

  Store.prototype.enroll = function (studentId, courseId) {
    if (!this.getStudent(studentId) || !this.getCourse(courseId)) throw new Error('Unknown student or course');
    if (this.isEnrolled(studentId, courseId)) return false;
    this.state.enrollments.push({ studentId: studentId, courseId: courseId });
    this.save();
    return true;
  };

  Store.prototype.unenroll = function (studentId, courseId) {
    this.state.enrollments = this.state.enrollments.filter(function (e) {
      return !(e.studentId === studentId && e.courseId === courseId);
    });
    this.save();
  };

  Store.prototype.studentsInCourse = function (courseId) {
    var self = this;
    return this.state.enrollments
      .filter(function (e) { return e.courseId === courseId; })
      .map(function (e) { return self.getStudent(e.studentId); })
      .filter(Boolean)
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  };

  Store.prototype.coursesForStudent = function (studentId) {
    var self = this;
    return this.state.enrollments
      .filter(function (e) { return e.studentId === studentId; })
      .map(function (e) { return self.getCourse(e.courseId); })
      .filter(Boolean);
  };

  /* Grades */
  Store.prototype.addGrade = function (fields) {
    var score = Number(fields.score);
    if (!isFinite(score) || score < 0 || score > 100) throw new Error('Score must be between 0 and 100');
    var label = (fields.label || '').trim();
    if (!label) throw new Error('Assessment name is required');
    if (!this.isEnrolled(fields.studentId, fields.courseId)) {
      throw new Error('Student is not enrolled in that course');
    }
    var grade = { id: uid(), studentId: fields.studentId, courseId: fields.courseId, label: label, score: score };
    this.state.grades.push(grade);
    this.save();
    return grade;
  };

  Store.prototype.removeGrade = function (id) {
    this.state.grades = this.state.grades.filter(function (g) { return g.id !== id; });
    this.save();
  };

  Store.prototype.studentAverage = function (studentId) {
    return average(this.state.grades
      .filter(function (g) { return g.studentId === studentId; })
      .map(function (g) { return g.score; }));
  };

  /* Attendance: one record per (course, date, student) */
  Store.prototype.setAttendance = function (courseId, date, studentId, status) {
    if (['present', 'absent', 'late'].indexOf(status) === -1) throw new Error('Invalid status');
    var rec = this.state.attendance.find(function (a) {
      return a.courseId === courseId && a.date === date && a.studentId === studentId;
    });
    if (rec) rec.status = status;
    else this.state.attendance.push({ courseId: courseId, date: date, studentId: studentId, status: status });
    this.save();
  };

  Store.prototype.getAttendance = function (courseId, date, studentId) {
    var rec = this.state.attendance.find(function (a) {
      return a.courseId === courseId && a.date === date && a.studentId === studentId;
    });
    return rec ? rec.status : null;
  };

  /* Late counts as attended. */
  Store.prototype.attendanceRate = function () {
    var all = this.state.attendance;
    if (!all.length) return null;
    var attended = all.filter(function (a) { return a.status !== 'absent'; }).length;
    return attended / all.length;
  };

  /* Dashboard */
  Store.prototype.summary = function () {
    var self = this;
    var ranked = this.state.students
      .map(function (s) {
        var count = self.state.grades.filter(function (g) { return g.studentId === s.id; }).length;
        return { student: s, average: self.studentAverage(s.id), count: count };
      })
      .filter(function (r) { return r.average !== null; })
      .sort(function (a, b) { return b.average - a.average; });
    return {
      students: this.state.students.length,
      courses: this.state.courses.length,
      average: average(this.state.grades.map(function (g) { return g.score; })),
      attendanceRate: this.attendanceRate(),
      topStudents: ranked.slice(0, 5)
    };
  };

  /* Import / export */
  Store.prototype.exportJSON = function () {
    return JSON.stringify(this.state, null, 2);
  };

  Store.prototype.importJSON = function (text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !Array.isArray(data.students)) {
      throw new Error('Not a SchoolHub Lite export');
    }
    this.state = normalize(data);
    this.save();
  };

  Store.prototype.reset = function () {
    this.state = emptyState();
    this.save();
  };

  var api = { Store: Store, letterGrade: letterGrade, STORAGE_KEY: STORAGE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SchoolHub = api;
})(this);
