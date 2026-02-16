/**
 * UI templates/home.ts template generator
 *
 * @module @alexi/create/templates/ui/templates/home_ts
 */

/**
 * Generate templates/home.ts content for the UI app
 */
export function generateUiHomeTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Home Page
 *
 * Todo list UI component implementing the Alexi Design System.
 * This template is purely presentational - all CRUD operations
 * are handled via callbacks passed from the view.
 *
 * @module ${name}-ui/templates/home
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";
import { Div, Li, Span, Style, Ul } from "@html-props/built-ins";
import { Column, Expanded, Row } from "@html-props/layout";
import type { QuerySet } from "@alexi/db";
import { TodoModel } from "@${name}-ui/models.ts";
import {
  DSButton,
  DSCard,
  DSCheckbox,
  DSIcon,
  DSInput,
  DSText,
  DSThemeToggle,
} from "@${name}-ui/components/mod.ts";

/**
 * Home page - displays and manages the todo list
 *
 * Follows the MVT (Model-View-Template) pattern:
 * - Template is purely presentational
 * - All CRUD operations are callbacks passed from the view
 * - Template only manages UI state (input text, etc.)
 */
export class HomePage extends HTMLPropsMixin(HTMLElement, {
  // Data props
  loading: prop(false),
  todos: prop<QuerySet<TodoModel> | null>(null),

  // Callback props from view
  fetch: prop<(() => Promise<void>) | null>(null),
  createTodo: prop<((title: string) => Promise<void>) | null>(null),
  toggleTodo: prop<((todo: TodoModel) => Promise<void>) | null>(null),
  deleteTodo: prop<((todo: TodoModel) => Promise<void>) | null>(null),

  // UI state
  newTodoTitle: prop(""),
}) {
  private inputRef = ref<InstanceType<typeof DSInput>>(null);

  override connectedCallback(): void {
    this.attachShadow({ mode: "open" });
    super.connectedCallback();
  }

  override async mountedCallback(): Promise<void> {
    if (this.fetch) {
      await this.fetch();
    }
  }

  private handleInputChange = (e: Event): void => {
    // Support both CustomEvent (from DSInput) and native InputEvent
    const customEvent = e as CustomEvent;
    if (customEvent.detail?.value !== undefined) {
      this.newTodoTitle = customEvent.detail.value;
    } else {
      // Fallback for native input events
      const target = e.target as HTMLInputElement | null;
      if (target?.value !== undefined) {
        this.newTodoTitle = target.value;
      }
    }
  };

  private handleSubmit = async (): Promise<void> => {
    const title = (this.newTodoTitle ?? "").trim();
    if (!title || !this.createTodo) return;

    // Clear input immediately using the clear() method
    this.newTodoTitle = "";
    if (this.inputRef.current) {
      this.inputRef.current.clear();
    }

    // Call the create callback from view
    await this.createTodo(title);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      this.handleSubmit();
    }
  };

  private handleToggle = async (todo: TodoModel): Promise<void> => {
    if (this.toggleTodo) {
      await this.toggleTodo(todo);
    }
  };

  private handleDelete = async (todo: TodoModel): Promise<void> => {
    if (this.deleteTodo) {
      await this.deleteTodo(todo);
    }
  };

  override render(): Node[] {
    return [
      new Style({ textContent: HOME_STYLES }),
      new Div({
        className: "home-container",
        content: [
          // Header section with theme toggle
          new Row({
            dataset: { key: "header" },
            className: "home-header",
            mainAxisAlignment: "spaceBetween",
            crossAxisAlignment: "start",
            content: [
              // Spacer for centering
              new Div({ style: { width: "40px" } }),

              // Logo and title
              new Column({
                crossAxisAlignment: "center",
                gap: "8px",
                content: [
                  new DSIcon({
                    name: "sparkles",
                    size: "xl",
                    color: "var(--alexi-accent-500)",
                  }),
                  new DSText({
                    variant: "h1",
                    gradient: true,
                    content: ["Todo App"],
                  }),
                  new DSText({
                    variant: "caption",
                    color: "muted",
                    content: ["Built with Alexi Framework"],
                  }),
                ],
              }),

              // Theme toggle
              new DSThemeToggle({}),
            ],
          }),

          // Main card
          new DSCard({
            variant: "raised",
            padding: "none",
            className: "home-card",
            content: [
              // Input section
              new Row({
                dataset: { key: "input-section" },
                gap: "12px",
                crossAxisAlignment: "center",
                style: { padding: "1.5rem" },
                content: [
                  new Expanded({
                    onkeydown: this.handleKeyDown,
                    content: new DSInput({
                      ref: this.inputRef,
                      placeholder: "What needs to be done?",
                      size: "lg",
                      value: this.newTodoTitle,
                      oninput: this.handleInputChange,
                      style: { width: "100%" },
                    }),
                  }),
                  new DSButton({
                    variant: "primary",
                    size: "lg",
                    disabled: !(this.newTodoTitle ?? "").trim(),
                    onclick: this.handleSubmit,
                    content: [
                      new DSIcon({ name: "plus", size: "sm" }),
                      new Span({ textContent: "Add Task" }),
                    ],
                  }),
                ],
              }),

              // Divider
              new Div({ className: "home-divider" }),

              // Todo list section
              this.loading ? this.renderLoading() : this.renderTodoList(),
            ],
          }),

          // Footer
          new Div({
            className: "home-footer",
            content: [
              new DSText({
                variant: "caption",
                color: "muted",
                content: [
                  "Powered by ",
                  new Span({ className: "home-footer-link", textContent: "Alexi" }),
                  " + ",
                  new Span({ className: "home-footer-link", textContent: "HTML Props" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];
  }

  private renderLoading(): Node {
    return new Column({
      dataset: { key: "loading" },
      className: "home-loading",
      crossAxisAlignment: "center",
      gap: "16px",
      content: [
        new DSIcon({ name: "loader", size: "lg", color: "var(--alexi-primary-500)" }),
        new DSText({ variant: "body", color: "muted", content: ["Loading todos..."] }),
      ],
    });
  }

  private renderTodoList(): Node {
    const todos = this.todos?.array() ?? [];

    if (todos.length === 0) {
      return new Column({
        dataset: { key: "empty" },
        className: "home-empty",
        crossAxisAlignment: "center",
        gap: "12px",
        content: [
          new DSIcon({ name: "clipboard", size: "xl", color: "var(--alexi-neutral-400)" }),
          new DSText({ variant: "h4", content: ["No tasks yet"] }),
          new DSText({
            variant: "body",
            color: "muted",
            content: ["Add your first task above to get started!"],
          }),
        ],
      });
    }

    const completedCount = todos.filter((t) => t.completed.get()).length;
    const totalCount = todos.length;

    return new Column({
      gap: "0",
      content: [
        // Stats bar
        new Row({
          dataset: { key: "stats" },
          className: "home-stats",
          gap: "8px",
          crossAxisAlignment: "center",
          content: [
            new DSIcon({ name: "clipboard-check", size: "sm", color: "var(--alexi-neutral-500)" }),
            new DSText({
              variant: "caption",
              color: "muted",
              content: [\`\${totalCount} task\${totalCount !== 1 ? "s" : ""}\`],
            }),
            new Span({ className: "home-stats-dot", textContent: "•" }),
            new DSText({
              variant: "caption",
              color: "primary",
              weight: "semibold",
              content: [\`\${completedCount} completed\`],
            }),
          ],
        }),

        // Todo items
        new Ul({
          dataset: { key: "todo-list" },
          className: "todo-list",
          content: todos.map((todo, index) =>
            this.renderTodoItem(todo, index === todos.length - 1)
          ),
        }),
      ],
    });
  }

  private renderTodoItem(todo: TodoModel, isLast: boolean): Node {
    const completed = todo.completed.get() as boolean;

    return new Li({
      dataset: { key: \`todo-\${todo.id.get()}\` },
      className: \`todo-item\${isLast ? " todo-item-last" : ""}\${completed ? " todo-item-completed" : ""}\`,
      content: [
        new DSCheckbox({
          checked: completed,
          onchange: () => this.handleToggle(todo),
        }),
        new DSText({
          variant: "body",
          className: "todo-text",
          content: [todo.title.get() as string],
        }),
        new DSButton({
          variant: "ghost",
          size: "sm",
          onclick: () => this.handleDelete(todo),
          content: [new DSIcon({ name: "trash", size: "sm" })],
        }),
      ],
    });
  }
}

// Register the custom element
HomePage.define("home-page");

/**
 * Home page styles - Alexi Design System
 */
const HOME_STYLES = \`
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap");

  :host {
    display: block;
    margin: 0;
    padding: 0;

    /* Color tokens */
    --alexi-primary-400: #34d399;
    --alexi-primary-500: #10b981;
    --alexi-primary-600: #059669;
    --alexi-accent-400: #7e57c2;
    --alexi-accent-500: #673ab7;
    --alexi-neutral-0: #ffffff;
    --alexi-neutral-50: #fafafa;
    --alexi-neutral-100: #f4f4f5;
    --alexi-neutral-200: #e4e4e7;
    --alexi-neutral-300: #d4d4d8;
    --alexi-neutral-400: #a1a1aa;
    --alexi-neutral-500: #71717a;
    --alexi-neutral-600: #52525b;
    --alexi-neutral-700: #3f3f46;
    --alexi-neutral-800: #27272a;
    --alexi-neutral-900: #18181b;
    --alexi-neutral-950: #09090b;

    /* Semantic tokens - light mode defaults */
    --bg-color: var(--alexi-neutral-950);
    --divider: var(--alexi-neutral-700);
  }

  .home-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1.5rem;
    font-family: "Nunito", system-ui, sans-serif;
    background: var(--bg-color);
    transition: background-color 200ms ease;
  }

  /* Header */
  .home-header {
    width: 100%;
    max-width: 560px;
    margin-bottom: 2rem;
  }

  /* Main card */
  .home-card {
    width: 100%;
    max-width: 560px;
  }



  .home-divider {
    height: 1px;
    background: var(--divider);
  }

  /* Loading state */
  .home-loading {
    padding: 3rem;
  }

  /* Empty state */
  .home-empty {
    padding: 3rem;
    text-align: center;
  }

  /* Stats bar */
  .home-stats {
    padding: 0.75rem 1.5rem;
    background: var(--alexi-neutral-900);
    border-bottom: 1px solid var(--divider);
  }

  .home-stats-dot {
    color: var(--alexi-neutral-300);
  }

  /* Todo list */
  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--alexi-neutral-700);
    transition: background-color 150ms ease;
    background: transparent;
  }

  .todo-item:hover {
    background-color: var(--alexi-neutral-800);
  }

  .todo-item-last {
    border-bottom: none;
  }

  .todo-text {
    flex: 1;
    transition: all 150ms ease;
  }

  .todo-item-completed .todo-text {
    text-decoration: line-through;
    opacity: 0.5;
  }

  /* Footer */
  .home-footer {
    margin-top: 2rem;
  }

  .home-footer-link {
    color: var(--alexi-primary-600);
    font-weight: 600;
  }

  /* =========================================================================
     DARK MODE
     ========================================================================= */

  /* Light mode via data-theme attribute */
  :host-context([data-theme="light"]) {
    --bg-color: var(--alexi-neutral-100);
    --divider: var(--alexi-neutral-200);
  }

  :host-context([data-theme="light"]) .home-stats {
    background: var(--alexi-neutral-50);
    border-bottom-color: var(--alexi-neutral-200);
  }

  :host-context([data-theme="light"]) .home-stats-dot {
    color: var(--alexi-neutral-300);
  }

  :host-context([data-theme="light"]) .todo-item {
    border-bottom-color: var(--alexi-neutral-200);
  }

  :host-context([data-theme="light"]) .todo-item:hover {
    background-color: var(--alexi-neutral-100);
  }

  :host-context([data-theme="light"]) .home-footer-link {
    color: var(--alexi-primary-600);
  }
\`;
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
