/**
 * Static index.html template generator (SPA shell)
 *
 * @module @alexi/create/templates/unified/static_index_html
 */

/**
 * Generate static/<name>/index.html content
 */
export function generateStaticIndexHtml(name: string): string {
  const title = toPascalCase(name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div id="content"></div>
  <script src="https://unpkg.com/htmx.org@2" defer></script>
  <script>
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/${name}/worker.js", { type: "module" }).then((reg) => {
        function render() {
          htmx.ajax("GET", "/", { target: "#content", swap: "innerHTML" });
        }
        if (navigator.serviceWorker.controller) {
          render();
        } else {
          const worker = reg.installing || reg.waiting;
          if (worker) {
            worker.addEventListener("statechange", function () {
              if (this.state === "activated") render();
            });
          }
        }
      });
    }
  </script>
</body>
</html>
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
