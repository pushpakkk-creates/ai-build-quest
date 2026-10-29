/**
 * AI Build Quest backend: saves registrations and counts referrals in a Google Sheet.
 *
 * Setup (about 5 minutes):
 *  1. Create a new Google Sheet. Open Extensions > Apps Script and paste this file.
 *  2. Run the function `setup` once and approve the permissions.
 *  3. Deploy > New deployment > type "Web app".
 *     Execute as: Me. Who has access: Anyone. Copy the /exec URL.
 *  4. Paste that URL into CONFIG.apiUrl in index.html.
 *  After editing this script later, use Deploy > Manage deployments > Edit > New version.
 */

var SHEET = 'Registrations';
var HEADERS = ['Timestamp', 'Code', 'Name', 'Email', 'WhatsApp', 'College', 'Branch', 'Year',
               'ReferredBy', 'Source', 'MaxStage', 'Idea', 'Referrals'];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i; });

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET); }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function rows_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, HEADERS.length).getValues();
}

function countRefs_(rows, code) {
  var c = 0;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][COL.ReferredBy]) === code) c++;
  return c;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var sh = sheet_();
  if (p.action === 'count') {
    var code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return json_({ ok: true, refs: countRefs_(rows_(sh), code) });
  }
  return json_({ ok: true, total: Math.max(0, sh.getLastRow() - 1) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = sheet_();
    if (d.action === 'register') return json_(register_(sh, d));
    if (d.action === 'progress') return json_(update_(sh, d.code, 'MaxStage', Number(d.stage) || 0, true));
    if (d.action === 'idea') return json_(update_(sh, d.code, 'Idea', String(d.idea || '').slice(0, 300), false));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
}

function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
// Stop spreadsheet formulas injected through text fields.
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function register_(sh, d) {
  if (d.website) return { ok: true, code: 'BOTS-0000', refs: 0, total: 0 };   // honeypot
  var name = clean_(d.name, 80), email = clean_(d.email, 120).toLowerCase();
  var phone = String(d.phone || '').replace(/\D/g, '').slice(-10);
  var college = clean_(d.college, 120), branch = clean_(d.branch, 40), year = clean_(d.year, 40);
  if (name.length < 2) return { ok: false, error: 'Enter your full name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: 'Enter a 10-digit Indian mobile number.' };
  if (college.length < 2 || !branch || !year) return { ok: false, error: 'Please fill in every field.' };

  var rows = rows_(sh), i;
  for (i = 0; i < rows.length; i++) {            // same email or phone: return the existing seat
    if (String(rows[i][COL.Email]).toLowerCase() === email || String(rows[i][COL.WhatsApp]).slice(-10) === phone) {
      var existing = String(rows[i][COL.Code]);
      return { ok: true, existing: true, code: existing, refs: countRefs_(rows, existing), total: rows.length };
    }
  }
  var ref = clean_(d.ref, 12).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  var refOk = '';
  if (ref) {
    for (i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.Code]) === ref) { refOk = ref; break; }   // self-referral is impossible: same email/phone returned above
    }
  }
  var used = {}; rows.forEach(function (r) { used[String(r[COL.Code])] = 1; });
  var code, tries = 0;
  do { code = makeCode_(name); tries++; } while (used[code] && tries < 30);

  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, HEADERS.length - 1).setValues([[
    new Date(), code, safe_(name), email, phone, safe_(college), branch, year,
    refOk, safe_(clean_(d.src, 30)), Number(d.stage) || 0, ''
  ]]);
  sh.getRange(row, COL.Referrals + 1).setFormula('=COUNTIF(I:I,B' + row + ')');
  return { ok: true, existing: false, code: code, refs: 0, total: rows.length + 1 };
}

function makeCode_(name) {
  var base = name.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
  while (base.length < 4) base += 'X';
  var al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 4; i++) s += al.charAt(Math.floor(Math.random() * al.length));
  return base + '-' + s;
}

function update_(sh, code, field, value, onlyIfHigher) {
  code = String(code || '').toUpperCase();
  var rows = rows_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][COL.Code]) === code) {
      var cell = sh.getRange(i + 2, COL[field] + 1);
      if (onlyIfHigher && Number(cell.getValue()) >= value) return { ok: true };
      cell.setValue(typeof value === 'string' ? safe_(value) : value);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Unknown code.' };
}
