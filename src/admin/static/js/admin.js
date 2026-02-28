/**
 * Alexi Admin JS
 *
 * Injects JWT Authorization header into every HTMX request.
 * Token is stored in localStorage under "adminToken".
 *
 * Also manages the color theme (light / dark / auto) via
 * data-theme on <html> and localStorage under "adminTheme".
 */
(function () {
  // -------------------------------------------------------------------------
  // Auth helpers
  // -------------------------------------------------------------------------

  var TOKEN_KEY = "adminToken";

  // Inject Authorization header on every HTMX request
  document.body.addEventListener("htmx:configRequest", function (evt) {
    var token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      evt.detail.headers["Authorization"] = "Bearer " + token;
    }
  });

  // Handle login/logout responses: store/clear token, then redirect.
  // We use custom X-Admin-* headers instead of HX-Redirect because HTMX
  // processes HX-Redirect synchronously before htmx:afterRequest fires,
  // causing navigation before the token can be stored/cleared in localStorage.
  document.body.addEventListener("htmx:afterRequest", function (evt) {
    var token = evt.detail.xhr.getResponseHeader("X-Admin-Token");
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (e) {}
    }
    var logout = evt.detail.xhr.getResponseHeader("X-Admin-Logout");
    if (logout) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
    }
    var redirect = evt.detail.xhr.getResponseHeader("X-Admin-Redirect");
    if (redirect) {
      window.location.href = redirect;
    }
  });

  // Expose helpers for login/logout
  window.adminAuth = {
    setToken: function (token) {
      localStorage.setItem(TOKEN_KEY, token);
    },
    removeToken: function () {
      localStorage.removeItem(TOKEN_KEY);
    },
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },
  };

  // -------------------------------------------------------------------------
  // Theme management
  // Supported values: "auto" (follows system), "light", "dark"
  // -------------------------------------------------------------------------

  var THEME_KEY = "adminTheme";
  var THEMES = ["auto", "dark", "light"];

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) theme = "auto";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || "auto";
    var idx = THEMES.indexOf(current);
    var next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
  }

  // Restore saved theme immediately (before paint to avoid flash)
  var savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch (e) {}
  applyTheme(savedTheme || "auto");

  // Expose theme helpers globally
  window.adminTheme = {
    apply: applyTheme,
    toggle: toggleTheme,
    get: function () {
      return document.documentElement.getAttribute("data-theme") || "auto";
    },
  };
})();
