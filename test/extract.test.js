// Usage: node test/extract.test.js [saved-page.html]
// Without an argument, fetches the live latest issue.
var fs = require("fs");
var assert = require("assert");
var app = require("../brewreader/main.js");

assert.strictEqual(app.formatDate("2026-11-01T06:00:00-05:00"), "November 1, 2026");
assert.strictEqual(app.extractIssue("<html>no data</html>"), null);

function check(page) {
  var issue = app.extractIssue(page);
  assert.ok(issue, "issueData not found in page");
  assert.ok(issue.html.length > 1000, "issue html suspiciously short");
  console.log("ok:", issue.subject, "|", app.formatDate(issue.date), "|", issue.html.length, "chars");
}

if (process.argv[2]) {
  check(fs.readFileSync(process.argv[2], "utf8"));
} else {
  fetch("https://www.morningbrew.com/issues/latest", { headers: { "User-Agent": "Mozilla/5.0" } })
    .then(function (r) { return r.text(); })
    .then(check)
    .catch(function (e) { console.error(e); process.exit(1); });
}
