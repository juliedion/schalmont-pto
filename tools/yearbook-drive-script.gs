/* ============================================================
   Schalmont PTO — yearbook photos → Google Drive
   ------------------------------------------------------------
   This runs as a Google Apps Script on the PTO's Google account. The website's
   api/yearbook-upload.php sends it each photo from the yearbook photo form, and it
   files the photo in Drive as:

     Schalmont PTO Yearbook Photos /
       Middle School / Fall Concert / Maya Chen (6th grade), Liam Portnoy (7th grade) - ….jpg

   EVENTS: the folders inside each school's folder ARE the form's event list. To add
   an event, a coordinator just makes a new folder inside their school's folder; it
   shows up on the form within a couple of minutes. Photos with no event go to
   "No event chosen"; ones where the parent typed in some other event go to
   "Other events" (the typed name is in the sheet and the photo's description).
   A photo of students from two schools is filed in both schools' folders.

   Every photo is also logged
   in the "Yearbook photo submissions" sheet in the top folder: school, event,
   students, grades, who sent it, their email, and a link to the photo.
   Share each SCHOOL folder with that school's yearbook coordinator. Keep the top
   folder (and its sheet, which has parents' emails) to PTO officers.

   SETUP (one time, ~10 minutes) — steps are also in api/config.example.php:
     1. Signed in to the PTO Google account, go to script.google.com → New project.
        Name it "Schalmont Yearbook Photos". Delete what's there and paste this file.
     2. Pick "setup" in the function menu at the top and press Run. Allow the
        permissions it asks for (it needs to make folders and a sheet in your Drive).
        Open "Execution log": it shows the SECRET KEY and the folder link.
     3. Deploy → New deployment → gear icon → "Web app".
          • Execute as: Me      • Who has access: Anyone
        Press Deploy and copy the "Web app URL" (ends in /exec).
     4. Put the URL and the secret key in the website's private api/config.php on
        Bluehost ('yearbook_drive_url' and 'yearbook_drive_secret').
   To file photos in a different folder you already have: Project Settings
   (gear) → Script Properties → set ROOT_ID to the folder's id (the part after
   /folders/). The PTO Google account needs Editor access to that folder.
   If you ever change this code: Deploy → Manage deployments → edit (pencil) →
   Version: New version → Deploy. The URL stays the same.
   ============================================================ */

var ROOT_NAME = 'Schalmont PTO Yearbook Photos';
var SHEET_NAME = 'Yearbook photo submissions';
var SCHOOL_NAMES = { woestina: 'Woestina', jefferson: 'Jefferson', middle: 'Middle School', high: 'High School', pto: 'PTO-wide' };
var NO_EVENT = 'No event chosen', OTHER_EVENTS = 'Other events';

function setup() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  if (!secret) { secret = Utilities.getUuid().replace(/-/g, ''); props.setProperty('SECRET', secret); }
  var root = rootFolder_();
  Object.keys(SCHOOL_NAMES).forEach(function (k) { if (k !== 'pto') child_(root, SCHOOL_NAMES[k]); });
  logSheet_();
  Logger.log('SECRET KEY (for config.php): ' + secret);
  Logger.log('Photos folder: ' + root.getUrl());
}

// The website asks for each school's event folders (folder names only) to fill the form's list.
function doGet(e) {
  var cache = CacheService.getScriptCache(), hit = cache.get('events');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  var root = rootFolder_(), events = {};
  Object.keys(SCHOOL_NAMES).forEach(function (k) {
    if (k === 'pto') return;
    var names = [], it = child_(root, SCHOOL_NAMES[k]).getFolders();
    while (it.hasNext()) {
      var n = it.next().getName();
      if (n !== NO_EVENT && n !== OTHER_EVENTS && !/^\d{4}-\d{2}$/.test(n)) names.push(n);
    }
    events[k] = names.sort(function (a, b) { return a.localeCompare(b); });
  });
  var out = JSON.stringify({ ok: true, events: events });
  cache.put('events', out, 120);   // a new Drive folder shows on the form within 2 minutes
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return json_({ ok: false, error: 'Not allowed' });

    // One at a time while finding/creating folders, so two photos sent at once
    // don't make two copies of the same event folder.
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    var folder;
    try {
      var school = child_(rootFolder_(), SCHOOL_NAMES[req.school] || 'Other');
      // An event picked from the list is one of this school's folders; anything typed in goes to "Other events".
      folder = child_(school, clean_(req.eventFolder) || (req.eventLabel ? OTHER_EVENTS : NO_EVENT));
    } finally { lock.releaseLock(); }

    var blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType || 'application/octet-stream', clean_(req.filename) || 'photo.jpg');
    var file = folder.createFile(blob);
    file.setDescription(
      'Students: ' + (req.students || '') + '\nGrades: ' + (req.grades || '') +
      '\nEvent: ' + (req.eventLabel || NO_EVENT) +
      '\nSent by: ' + (req.uploaderName || '') + ' <' + (req.uploaderEmail || '') + '>' +
      '\nOriginal file: ' + (req.original || ''));

    logSheet_().appendRow([new Date(), SCHOOL_NAMES[req.school] || req.school, req.eventLabel || NO_EVENT,
      req.students || '', req.grades || '', req.uploaderName || '', req.uploaderEmail || '', file.getUrl(), req.batchId || '']);
    return json_({ ok: true, id: file.getId(), url: file.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---- helpers ---- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s || '').replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150); }
function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function rootFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ROOT_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (_) {} }
  var root = DriveApp.createFolder(ROOT_NAME);
  props.setProperty('ROOT_ID', root.getId());
  return root;
}
function logSheet_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (_) {} }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder_());
  var sh = ss.getSheets()[0];
  sh.appendRow(['Received', 'School', 'Event', 'Students', 'Grades', 'Sent by', 'Email', 'Photo', 'Submission ID']);
  sh.setFrozenRows(1);
  sh.getRange('1:1').setFontWeight('bold');
  props.setProperty('SHEET_ID', ss.getId());
  return sh;
}
