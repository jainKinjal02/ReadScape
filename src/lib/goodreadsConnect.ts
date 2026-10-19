/**
 * Importing straight from Goodreads, without the reader handling a file.
 *
 * Goodreads has no API, so this does in an in-app browser what the reader
 * would otherwise do by hand: they sign in on Goodreads' own pages (Readscape
 * never sees their password), then the app opens goodreads.com/review/import,
 * presses "Export Library", waits for Goodreads to prepare the file, and reads
 * the CSV. The CSV is then imported exactly like an uploaded file
 * (src/lib/goodreads.ts).
 *
 * The page script only reports what it sees and does what it is told; the
 * app keeps the state (whether it pressed Export, which export was there
 * before, how long it has waited). Page storage can't hold that: the in-app
 * browser is private, and its storage does not survive the page reloading,
 * which made an earlier version press Export again on every reload and wait
 * forever.
 *
 * It depends on Goodreads' page: a button labelled "Export Library" and, once
 * ready, a link labelled "Your export from <date>". If Goodreads changes
 * those, this stops working and the reader is offered the file upload.
 */

/** Where the reader signs in. Goodreads offers Amazon, Apple and email here. */
export const GOODREADS_SIGN_IN_URL = "https://www.goodreads.com/user/sign_in";

/** The page with the "Export Library" button. */
export const GOODREADS_EXPORT_PAGE = "https://www.goodreads.com/review/import";

/** Pages that mean the reader has not finished signing in. */
export function isSignInPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)goodreads\.com$/.test(u.hostname)) return true; // Amazon / Apple sign-in pages
    return /^\/(user\/(sign_in|new|sign_up)|ap\/|ap-handler)/.test(u.pathname);
  } catch {
    return true;
  }
}

export function isExportPage(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)goodreads\.com$/.test(u.hostname) && u.pathname.startsWith("/review/import");
  } catch {
    return false;
  }
}

export interface ExportLink {
  href: string;
  /** "Your export from 10/19/2026 - 20:35" */
  label: string;
}

/** Messages the page script posts back to the app. */
export type ConnectMessage =
  | { type: "exportPage"; hasButton: boolean; link: ExportLink | null }
  | { type: "csv"; text: string; label: string }
  | { type: "error"; reason: "download"; message?: string };

/** How long Goodreads gets to prepare a new export before we offer the old one. */
export const EXPORT_TIMEOUT_MS = 75 * 1000;

/** How often the export page is refreshed while waiting. */
export const EXPORT_RELOAD_MS = 10 * 1000;

export const linkKey = (l: ExportLink | null) => (l ? `${l.href}|${l.label}` : null);

/**
 * Runs on every page load. On the export page it reports, every two
 * seconds, whether the Export button is there and which export link is
 * showing, and offers two actions for the app to call: press Export, and
 * download a given link.
 */
export const EXPORT_SCRIPT = `
(function () {
  if (window.__readscape) return;
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var label = function (el) { return ((el.textContent || el.value || '') + '').replace(/\\s+/g, ' ').trim(); };
  var exportLink = function () {
    var a = all('a').filter(function (a) { return /^your export from/i.test(label(a)); })[0];
    return a ? { href: a.href, label: label(a) } : null;
  };
  var exportButton = function () {
    return all('button, input[type=submit], input[type=button], a').filter(function (el) {
      return /^export library$/i.test(label(el));
    })[0] || null;
  };

  // The link can appear a moment before the file behind it is ready, so a
  // failed download is retried a few times before giving up.
  var download = function (href, text, attempt) {
    attempt = attempt || 1;
    fetch(href, { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (csv) {
        if (!/title/i.test(csv.split('\\n')[0] || '')) throw new Error('not a library export');
        post({ type: 'csv', text: csv, label: text });
      })
      .catch(function (e) {
        if (attempt < 5) { setTimeout(function () { download(href, text, attempt + 1); }, 3000); return; }
        post({ type: 'error', reason: 'download', message: String(e) });
      });
  };

  window.__readscape = {
    pressExport: function () { var b = exportButton(); if (b) b.click(); },
    download: download,
  };

  if (location.pathname.indexOf('/review/import') !== 0) return;
  var report = function () {
    post({ type: 'exportPage', hasButton: !!exportButton(), link: exportLink() });
  };
  report();
  setInterval(report, 2000);
})();
true;
`;

export const PRESS_EXPORT = `window.__readscape && window.__readscape.pressExport(); true;`;
export const RELOAD_PAGE = `location.reload(); true;`;

export function downloadScript(link: ExportLink): string {
  return `window.__readscape && window.__readscape.download(${JSON.stringify(link.href)}, ${JSON.stringify(
    link.label
  )}); true;`;
}
