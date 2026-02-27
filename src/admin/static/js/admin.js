/**
 * Alexi Admin JS
 *
 * Injects JWT Authorization header into every HTMX request.
 * Token is stored in localStorage under "adminToken".
 */
(function () {
  var TOKEN_KEY = "adminToken";

  // Inject Authorization header on every HTMX request
  document.body.addEventListener("htmx:configRequest", function (evt) {
    var token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      evt.detail.headers["Authorization"] = "Bearer " + token;
    }
  });

  // Handle HX-Redirect response header (used after login)
  document.body.addEventListener("htmx:afterRequest", function (evt) {
    var redirect = evt.detail.xhr.getResponseHeader("HX-Redirect");
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
})();
