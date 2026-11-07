// Usage: node test/extract.test.js [saved-page.html]
// Without an argument, fetches the live latest issue.
var fs = require("fs");
var assert = require("assert");
var app = require("../brewreader/main.js");

assert.strictEqual(app.formatDate("2026-11-01T06:00:00-05:00"), "November 1, 2026");
assert.strictEqual(app.extractIssue("<html>no data</html>"), null);
assert.ok(app.issueIsToday("2026-11-01T06:00:00-05:00", new Date(2026, 10, 1, 9)));
assert.ok(!app.issueIsToday("2026-10-31T06:00:00-05:00", new Date(2026, 10, 1, 9)));

function check(page) {
  var issue = app.extractIssue(page);
  assert.ok(issue, "issueData not found in page");
  assert.ok(issue.html.length > 1000, "issue html suspiciously short");
  console.log("ok:", issue.subject, "|", app.formatDate(issue.date), "|", issue.html.length, "chars");
}

if (process.argv[2]) {
  check(fs.readFileSync(process.argv[2], "utf8"));
} else {
  // Retries so one blocked or slow request (e.g. from a CI runner) isn't reported as the page changing.
  var attempts = 3;
  var tryFetch = function (n) {
    fetch("https://www.morningbrew.com/issues/latest", { headers: { "User-Agent": "Mozilla/5.0" } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " " + r.statusText);
        return r.text();
      })
      .then(check)
      .catch(function (e) {
        console.error("attempt " + n + "/" + attempts + " failed:", e.message);
        if (n < attempts) setTimeout(function () { tryFetch(n + 1); }, 20000);
        else process.exit(1);
      });
  };
  tryFetch(1);
}
