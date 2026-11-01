// Brew Reader: unofficial Morning Brew newsletter reader for Kindle (mesquite/WAF). ES5 only: the Kindle browser is old WebKit.

var ISSUE_URL = "https://www.morningbrew.com/issues/latest";
// Written by brewreader.sh at launch, used when the live request fails (e.g. blocked cross-origin).
var LOCAL_COPY = "latest.html";

var NEXT_DATA_OPEN = '<script id="__NEXT_DATA__" type="application/json">';

// Pull issueData out of the Next.js page payload. Returns null if the page layout changed.
function extractIssue(pageHtml) {
  var start = pageHtml.indexOf(NEXT_DATA_OPEN);
  if (start < 0) return null;
  start += NEXT_DATA_OPEN.length;
  var end = pageHtml.indexOf("</script>", start);
  if (end < 0) return null;
  var data;
  try {
    data = JSON.parse(pageHtml.substring(start, end));
  } catch (e) {
    return null;
  }
  var issue = data && data.props && data.props.pageProps && data.props.pageProps.issueData;
  if (!issue || !issue.html) return null;
  return {
    html: issue.html,
    date: issue.date || "",
    subject: issue.subjectLine || issue.title || "Morning Brew"
  };
}

function formatDate(iso) {
  var months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return months[parseInt(m[2], 10) - 1] + " " + parseInt(m[3], 10) + ", " + m[1];
}

// Image URLs carry the original size, e.g. ".../image-<hash>-1500x1875-jpg/..." or ".../<hash>-1350x330.png".
var IMG_DIMS = /-(\d+)x(\d+)[-.]/;
var SOCIAL_ALT = /facebook|instagram|linkedin|twitter|youtube|tiktok|threads|share on/i;

// Widths are rounded up to a few sizes so every Kindle requests the same cached variants
// rather than costing the CDN a new transformation per screen size.
var IMG_WIDTHS = [200, 400, 800, 1200];

function bucketWidth(px) {
  for (var i = 0; i < IMG_WIDTHS.length; i++) if (px <= IMG_WIDTHS[i]) return IMG_WIDTHS[i];
  return IMG_WIDTHS[IMG_WIDTHS.length - 1];
}

// Ask the image CDNs for a copy sized to the screen and already grayscale; the Kindle's own downscaling is poor.
function resizedUrl(src, px) {
  px = bucketWidth(px);
  if (/\/cdn-cgi\/image\/[^\/]+\//.test(src)) {
    return src.replace(/\/cdn-cgi\/image\/[^\/]+\//, "/cdn-cgi/image/width=" + px + ",quality=70,saturation=0,sharpen=1,format=auto/");
  }
  if (/^https:\/\/cdn\.sanity\.io\//.test(src)) {
    return src.split("?")[0] + "?w=" + px + "&fit=max&sat=-100&q=70";
  }
  return src;
}

var DROP_TAGS =["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "noscript"];
var DROP_ATTRS = ["style", "class", "id", "width", "height", "bgcolor", "background", "align", "valign", "border", "cellpadding", "cellspacing"];

// Email HTML is table-based with inline styles. Strip it down to plain content that our CSS can lay out,
// and remove anything executable since the app runs with Kindle API access.
function sanitize(root) {
  var i, j, nodes;
  for (i = 0; i < DROP_TAGS.length; i++) {
    nodes = root.getElementsByTagName(DROP_TAGS[i]);
    for (j = nodes.length - 1; j >= 0; j--) nodes[j].parentNode.removeChild(nodes[j]);
  }
  nodes = root.getElementsByTagName("*");
  for (i = nodes.length - 1; i >= 0; i--) {
    var el = nodes[i];
    if (el.tagName.toLowerCase() === "img") {
      var w = parseInt(el.getAttribute("width"), 10);
      var h = parseInt(el.getAttribute("height"), 10);
      // Tracking pixels and spacers.
      if ((w && w <= 2) || (h && h <= 2)) {
        el.parentNode.removeChild(el);
        continue;
      }
      // Hold the URL back so the full-size image doesn't start loading; sizeImages() sets a resized one.
      var src = el.getAttribute("src") || "";
      var dims = IMG_DIMS.exec(src);
      // Share buttons and social links: tiny icons that do nothing on a Kindle.
      var isIcon = dims && parseInt(dims[1], 10) <= 96 && parseInt(dims[2], 10) <= 96;
      if (isIcon || SOCIAL_ALT.test(el.getAttribute("alt") || "")) {
        el.parentNode.removeChild(el);
        continue;
      }
      if (/^https?:/i.test(src)) el.setAttribute("data-src", src);
      if (w) el.setAttribute("data-width", w);
      if (dims) el.setAttribute("data-ratio", parseInt(dims[2], 10) / parseInt(dims[1], 10));
      el.removeAttribute("src");
    }
    for (j = el.attributes.length - 1; j >= 0; j--) {
      var name = el.attributes[j].name.toLowerCase();
      if (name.indexOf("on") === 0 || DROP_ATTRS.indexOf(name) >= 0) el.removeAttribute(el.attributes[j].name);
    }
    if (el.hasAttribute("href") && /^\s*javascript:/i.test(el.getAttribute("href"))) el.removeAttribute("href");
    if (el.hasAttribute("src") && !/^https?:/i.test(el.getAttribute("src"))) el.removeAttribute("src");
  }
  return root;
}

function setStatus(text) {
  document.getElementById("status").innerText = text;
  document.getElementById("status").style.display = text ? "block" : "none";
}

function render(issue) {
  // An inert document: nothing in it runs or loads while we clean it.
  var doc = document.implementation.createHTMLDocument("issue");
  doc.documentElement.innerHTML = issue.html;
  var body = sanitize(doc.body);

  document.getElementById("issue-date").innerText = formatDate(issue.date);
  document.getElementById("issue-subject").innerText = issue.subject;
  var content = document.getElementById("content");
  content.innerHTML = body.innerHTML;
  setStatus("");
  sizeImages(content);
  paginate();
  showPage(0);
}

// Fixed sizes up front so pages don't shift as images arrive. Images are also kept shorter than
// a page so pagination never has to cut one in half.
function sizeImages(content) {
  var maxWidth = content.clientWidth;
  var maxHeight = document.getElementById("page").clientHeight - PAGE_TOP - 24;
  var dpr = window.devicePixelRatio || 1;
  var imgs = content.getElementsByTagName("img");
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var src = img.getAttribute("data-src");
    if (!src) continue;
    var width = Math.min(parseInt(img.getAttribute("data-width"), 10) || maxWidth, maxWidth);
    var ratio = parseFloat(img.getAttribute("data-ratio"));
    if (ratio && width * ratio > maxHeight) width = Math.floor(maxHeight / ratio);
    img.style.width = width + "px";
    if (ratio) img.style.height = Math.round(width * ratio) + "px";
    img.onload = repaginate;
    // If the CDN stops accepting our resize options, show the newsletter's own image instead.
    img.onerror = function () {
      this.onerror = null;
      this.src = this.getAttribute("data-src");
    };
    img.src = resizedUrl(src, Math.round(width * dpr));
  }
}

// E-ink handles continuous scrolling badly, so the issue is read a screen at a time, like a book:
// each page ends after its last whole line and the next page starts with the line that didn't fit.
// Positions are in #page scroll coordinates.
var PAGE_TOP = 16; // matches #page padding-top, kept as a margin above each page's first line
var pageStarts = [0];
var currentPage = 0;

// Vertical extent of every rendered line of text and every image.
function lineBoxes(root, offset) {
  var boxes = [];
  var range = document.createRange();
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  var node, rects, i;
  while ((node = walker.nextNode())) {
    if (!/\S/.test(node.nodeValue)) continue;
    range.selectNodeContents(node);
    rects = range.getClientRects();
    for (i = 0; i < rects.length; i++) {
      if (rects[i].height > 0) boxes.push([rects[i].top + offset, rects[i].bottom + offset]);
    }
  }
  var imgs = root.getElementsByTagName("img");
  for (i = 0; i < imgs.length; i++) {
    var r = imgs[i].getBoundingClientRect();
    if (r.height > 0) boxes.push([r.top + offset, r.bottom + offset]);
  }
  return boxes;
}

function paginate() {
  var page = document.getElementById("page");
  var spacer = document.getElementById("spacer");
  // Blank space after the issue so the last page can scroll to the top like any other.
  spacer.style.height = page.clientHeight + "px";
  var offset = page.scrollTop - page.getBoundingClientRect().top;
  var end = spacer.getBoundingClientRect().top + offset;
  var boxes = lineBoxes(page, offset);

  var starts = [0];
  var start = 0;
  while (true) {
    var top = Math.max(0, start - PAGE_TOP);
    var limit = top + page.clientHeight;
    if (limit >= end) break;
    // Break before the first line or image that would be cut by the bottom edge. Something taller
    // than a page (starting at or above this page's start) has to be cut, so it's skipped.
    var next = limit;
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i][0] > start && boxes[i][0] < next && boxes[i][1] > limit) next = boxes[i][0];
    }
    starts.push(next);
    start = next;
  }
  pageStarts = starts;
}

// Images without known dimensions change the layout when they arrive.
function repaginate() {
  var start = pageStarts[currentPage];
  paginate();
  var i = 0;
  while (i + 1 < pageStarts.length && pageStarts[i + 1] <= start) i++;
  showPage(i);
}

function showPage(index) {
  var page = document.getElementById("page");
  currentPage = Math.max(0, Math.min(pageStarts.length - 1, index));
  var start = pageStarts[currentPage];
  var next = pageStarts[currentPage + 1];
  var top = Math.max(0, start - PAGE_TOP);
  page.scrollTop = top;
  // White strips hide the end of the previous line above and the partial line below.
  document.getElementById("mask-top").style.height = (start - top) + "px";
  var bottom = document.getElementById("mask-bottom");
  bottom.style.display = next ? "block" : "none";
  if (next) bottom.style.top = (next - top) + "px";
  document.getElementById("page-number").innerText =
    pageStarts.length > 1 ? (currentPage + 1) + " / " + pageStarts.length : "";
}

function turnPage(direction) {
  showPage(currentPage + direction);
}

// Text size. Images are sized in px from the screen, so they stay the same at every text size.
var FONT_SIZES = [16, 18, 20, 23, 26, 30, 34];
var fontIndex = 2;

function loadFontSize() {
  try {
    var saved = parseInt(localStorage.getItem("fontIndex"), 10);
    if (saved >= 0 && saved < FONT_SIZES.length) fontIndex = saved;
  } catch (e) {}
  document.body.style.fontSize = FONT_SIZES[fontIndex] + "px";
}

function pageOffset(rect) {
  var page = document.getElementById("page");
  return rect.top - page.getBoundingClientRect().top + page.scrollTop;
}

// The text at the top of the current page, so the reader stays there when the layout changes.
function readingAnchor() {
  if (!document.caretRangeFromPoint) return null;
  var page = document.getElementById("page");
  var y = page.getBoundingClientRect().top + pageStarts[currentPage] - page.scrollTop + 2;
  var range = document.caretRangeFromPoint(document.getElementById("content").getBoundingClientRect().left + 2, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

function anchorOffset(anchor) {
  var range = document.createRange();
  if (anchor.node.nodeType === 3 && anchor.offset < anchor.node.length) {
    range.setStart(anchor.node, anchor.offset);
    range.setEnd(anchor.node, anchor.offset + 1);
  } else {
    range.selectNode(anchor.node);
  }
  var rect = range.getBoundingClientRect();
  return rect.height > 0 ? pageOffset(rect) : -1;
}

function changeFontSize(step) {
  var next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIndex + step));
  if (next === fontIndex) return;
  var anchor = readingAnchor();
  var oldPage = currentPage, oldCount = pageStarts.length;
  fontIndex = next;
  try { localStorage.setItem("fontIndex", fontIndex); } catch (e) {}
  document.body.style.fontSize = FONT_SIZES[fontIndex] + "px";
  paginate();

  var offset = anchor ? anchorOffset(anchor) : -1;
  if (offset < 0) {
    // No anchor available: keep roughly the same position through the issue.
    showPage(Math.round(oldPage * pageStarts.length / oldCount));
    return;
  }
  var i = 0;
  while (i + 1 < pageStarts.length && pageStarts[i + 1] <= offset + 1) i++;
  showPage(i);
}

function get(url, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    // file:// requests report status 0 on success.
    var ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText);
    cb(ok ? xhr.responseText : null);
  };
  try {
    xhr.send();
  } catch (e) {
    cb(null);
  }
}

// Set when a page downloaded fine but had no issue in it: Morning Brew changed their site, so
// telling the reader to check Wi-Fi would be wrong.
var pageChanged = false;

function loadFailed() {
  setStatus(pageChanged
    ? "Morning Brew's site has changed and Brew Reader can't read it yet. Check for an app update."
    : "Couldn't load today's issue. Check Wi-Fi and choose Reload from the menu.");
}

// The launcher downloads the local copy in the background, so it may not exist yet: retry for ~20s.
function loadLocal(attempt) {
  get(LOCAL_COPY, function (text) {
    var issue = text && extractIssue(text);
    if (text && !issue) pageChanged = true;
    if (issue) render(issue);
    else if (attempt < 10) setTimeout(function () { loadLocal(attempt + 1); }, 2000);
    else loadFailed();
  });
}

function loadLive() {
  pageChanged = false;
  get(ISSUE_URL + "?t=" + new Date().getTime(), function (text) {
    var issue = text && extractIssue(text);
    if (text && !issue) pageChanged = true;
    if (issue) render(issue);
    else loadLocal(0);
  });
}

function load() {
  setStatus("Loading today's issue...");
  var start = loadLive;
  if (window.kindle && window.kindle.net && window.kindle.net.ensureConnection) {
    // Prompts for Wi-Fi if needed; we try either way so the local copy can still show.
    window.kindle.net.ensureConnection("all", false, start);
  } else {
    start();
  }
}

function configureChrome() {
  if (!window.kindle) return;
  window.kindle.messaging.sendMessage("com.lab126.chromebar", "configureChrome", {
    "appId": "com.alexkisch.brewreader",
    "topNavBar": {
      "template": "title",
      "title": "Brew Reader",
      "buttons": [
        { "id": "KPP_MORE", "state": "enabled", "handling": "system" },
        { "id": "KPP_CLOSE", "state": "enabled", "handling": "system" }
      ]
    },
    "systemMenu": {
      "clientParams": {
        "profile": {
          "name": "default",
          "items": [
            { "id": "MB_RELOAD", "state": "enabled", "handling": "notifyApp", "label": "Reload", "position": 0 },
            { "id": "MB_FONT_LARGER", "state": "enabled", "handling": "notifyApp", "label": "Larger Text", "position": 1 },
            { "id": "MB_FONT_SMALLER", "state": "enabled", "handling": "notifyApp", "label": "Smaller Text", "position": 2 }
          ],
          "selectionMode": "none",
          "closeOnUse": true
        }
      }
    }
  });
}

if (typeof window !== "undefined") {
  if (window.kindle) {
    window.kindle.appmgr.ongo = function () {
      configureChrome();
      window.kindle.messaging.receiveMessage("systemMenuItemSelected", function (type, id) {
        if (id === "MB_RELOAD") load();
        else if (id === "MB_FONT_LARGER") changeFontSize(1);
        else if (id === "MB_FONT_SMALLER") changeFontSize(-1);
      });
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    // On body so taps on the page masks count too.
    var page = document.body;
    // Tap the left third to go back, anywhere else to go forward. This also stops links from
    // navigating the app away from the issue with no way back.
    page.addEventListener("click", function (e) {
      e.preventDefault();
      turnPage(e.clientX < window.innerWidth / 3 ? -1 : 1);
    });
    loadFontSize();
    // Swipe up for the next page, down for the previous one.
    var startX = 0, startY = 0;
    page.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    page.addEventListener("touchmove", function (e) { e.preventDefault(); });
    page.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
        e.preventDefault();
        turnPage(dy < 0 ? 1 : -1);
      }
    });
    load();
  });
}

if (typeof module !== "undefined") module.exports = { extractIssue: extractIssue, formatDate: formatDate };
