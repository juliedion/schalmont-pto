/* ============================================================
   Directory grade rollover (Julie, Nov 2026). Grades in the parent directory are typed
   once, so a listing saved in an earlier school year shows last year's grade. This moves
   each student up one grade per school year since the listing was last saved (school
   years roll over on July 1), sets the school that goes with the new grade, and drops the
   old teacher (no longer right). Used by js/app.js (directory) and admin/directory.html.
   Nothing is written to Firestore here; when a parent edits and saves their listing,
   the corrected grade is what gets saved.
   ============================================================ */
(function () {
  var GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade',
                '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
  var SCHOOL_FOR = function (i) {
    return i === 0 ? 'Woestina Pre-K' : i <= 5 ? 'Jefferson Elementary' : i <= 9 ? 'Schalmont Middle School' : 'Schalmont High School';
  };
  var KNOWN_SCHOOLS = ['', 'Woestina Pre-K', 'Jefferson Elementary', 'Schalmont Middle School', 'Schalmont High School'];

  function gradeIndex(g) {
    var v = String(g || '').trim(), i = GRADES.indexOf(v);
    if (i >= 0) return i;
    var k = v.toLowerCase().replace(/[\s.-]/g, '');
    if (k === 'prek') return 0;
    if (k === 'k' || k === 'kindergarten') return 1;
    var n = parseInt(k, 10);
    return (n >= 1 && n <= 12) ? n + 1 : -1;
  }
  // School year a date belongs to: Jul 2025 – Jun 2026 -> 2025.
  function schoolYear(d) { return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; }
  function asOf(m) {
    var s = m && (m.updatedAt || m.joined);
    var d = s ? new Date(String(s).length === 10 ? s + 'T12:00:00' : s) : null;
    return d && !isNaN(d) ? d : null;
  }

  // Returns a copy of the member with students moved up; marks them with gradeAdvanced.
  window.advanceDirectoryGrades = function (m, now) {
    var d = asOf(m);
    if (!m || !d || !Array.isArray(m.students)) return m;
    var years = schoolYear(now || new Date()) - schoolYear(d);
    if (years <= 0) return m;
    var out = Object.assign({}, m);
    out.students = m.students.map(function (s) {
      var i = gradeIndex(s.grade);
      if (i < 0) return s;
      var j = i + years, t = Object.assign({}, s, { gradeAdvanced: true, teacher: '' });
      if (j >= GRADES.length) { t.grade = 'Graduated'; t.school = ''; return t; }
      t.grade = GRADES[j];
      if (KNOWN_SCHOOLS.indexOf(s.school || '') >= 0) t.school = SCHOOL_FOR(j);
      return t;
    });
    return out;
  };
})();
