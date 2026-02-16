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
 *
 * @module ${name}-ui/templates/home
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";
import { Div, H1, Li, Span, Style, Ul } from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";
import type { QuerySet } from "@alexi/db";
import { TodoModel } from "@${name}-ui/models.ts";
import { rest } from "@${name}-ui/settings.ts";
import { DSButton, DSCheckbox, DSInput } from "@${name}-ui/components/mod.ts";

/**
 * Home page - displays and manages the todo list
 */
export class HomePage extends HTMLPropsMixin(HTMLElement, {
  loading: prop(false),
  todos: prop<QuerySet<TodoModel> | null>(null),
  fetch: prop<(() => Promise<void>) | null>(null),
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

  private handleInputChange = (e: CustomEvent): void => {
    this.newTodoTitle = e.detail.value;
  };

  private handleSubmit = async (): Promise<void> => {
    const title = this.newTodoTitle.trim();
    if (!title) return;

    // Clear input
    this.newTodoTitle = "";
    if (this.inputRef.current) {
      this.inputRef.current.value = "";
    }

    // Create new todo via REST backend
    const newTodo = await TodoModel.objects.using("rest").create({
      title,
      completed: false,
    });

    // Save to IndexedDB for offline cache
    await newTodo.using("indexeddb").save();

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      this.handleSubmit();
    }
  };

  private handleToggle = async (todo: TodoModel): Promise<void> => {
    todo.toggle();
    await rest.update(todo);

    // Update local cache
    await todo.using("indexeddb").save();

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  private handleDelete = async (todo: TodoModel): Promise<void> => {
    const todoId = todo.id.get();
    await rest.delete(todo);

    // Remove from local cache
    await TodoModel.objects.using("indexeddb").filter({ id: todoId }).delete();

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  override render(): Node[] {
    return [
      new Style({ textContent: HOME_STYLES }),
      new Div({
        className: "home-container",
        content: [
          // Header section
          new Div({
            dataset: { key: "header" },
            className: "home-header",
            content: [
              new Div({ className: "home-logo", textContent: "✨" }),
              new H1({
                className: "home-title",
                content: [
                  new Span({ textContent: "Todo " }),
                  new Span({ className: "home-title-accent", textContent: "App" }),
                ],
              }),
              new Span({
                className: "home-subtitle",
                textContent: "Built with Alexi Framework",
              }),
            ],
          }),

          // Main card
          new Div({
            className: "home-card",
            content: [
              // Input section
              new Div({
                dataset: { key: "input-section" },
                className: "home-input-section",
                content: [
                  new Row({
                    gap: "12px",
                    crossAxisAlignment: "stretch",
                    content: [
                      new Div({
                        style: { flex: "1" },
                        onkeydown: this.handleKeyDown,
                        content: [
                          new DSInput({
                            ref: this.inputRef,
                            placeholder: "What needs to be done?",
                            size: "lg",
                            value: this.newTodoTitle,
                            onchange: this.handleInputChange,
                          }),
                        ],
                      }),
                      new DSButton({
                        variant: "primary",
                        size: "lg",
                        disabled: !this.newTodoTitle.trim(),
                        onclick: this.handleSubmit,
                        content: ["Add Task"],
                      }),
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
              new Span({ textContent: "Powered by " }),
              new Span({ className: "home-footer-link", textContent: "Alexi" }),
              new Span({ textContent: " + " }),
              new Span({ className: "home-footer-link", textContent: "HTML Props" }),
            ],
          }),
        ],
      }),
    ];
  }

  private renderLoading(): Node {
    return new Div({
      dataset: { key: "loading" },
      className: "home-loading",
      content: [
        new Div({ className: "home-loading-spinner" }),
        new Span({ textContent: "Loading todos..." }),
      ],
    });
  }

  private renderTodoList(): Node {
    const todos = this.todos?.array() ?? [];

    if (todos.length === 0) {
      return new Div({
        dataset: { key: "empty" },
        className: "home-empty",
        content: [
          new Div({ className: "home-empty-icon", textContent: "📋" }),
          new Span({ className: "home-empty-title", textContent: "No tasks yet" }),
          new Span({ className: "home-empty-subtitle", textContent: "Add your first task above to get started!" }),
        ],
      });
    }

    const completedCount = todos.filter(t => t.completed.get()).length;
    const totalCount = todos.length;

    return new Column({
      gap: "0",
      content: [
        // Stats bar
        new Div({
          dataset: { key: "stats" },
          className: "home-stats",
          content: [
            new Span({ textContent: \`\${totalCount} task\${totalCount !== 1 ? "s" : ""}\` }),
            new Span({ className: "home-stats-dot", textContent: "•" }),
            new Span({
              className: "home-stats-completed",
              textContent: \`\${completedCount} completed\`,
            }),
          ],
        }),

        // Todo items
        new Ul({
          dataset: { key: "todo-list" },
          className: "todo-list",
          content: todos.map((todo, index) => this.renderTodoItem(todo, index === todos.length - 1)),
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
        new Span({
          className: "todo-text",
          textContent: todo.title.get() as string,
        }),
        new DSButton({
          variant: "ghost",
          size: "sm",
          onclick: () => this.handleDelete(todo),
          content: ["✕"],
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
  }

  .home-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    font-family: "Nunito", system-ui, sans-serif;
  }

  /* Header */
  .home-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2rem;
    text-align: center;
  }

  .home-logo {
    font-size: 3rem;
    margin-bottom: 0.5rem;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .home-title {
    font-family: "Fredoka", system-ui, sans-serif;
    font-size: 2.5rem;
    font-weight: 600;
    color: var(--alexi-neutral-900);
    margin: 0;
    line-height: 1.2;
  }

  .home-title-accent {
    background: linear-gradient(135deg, var(--alexi-primary-500), var(--alexi-accent-500));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .home-subtitle {
    font-size: 0.875rem;
    color: var(--alexi-neutral-500);
    margin-top: 0.5rem;
  }

  /* Main card */
  .home-card {
    width: 100%;
    max-width: 560px;
    background: var(--alexi-neutral-0);
    border: 1px solid var(--alexi-neutral-200);
    border-radius: 1.5rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.05),
      0 10px 15px -3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .home-input-section {
    padding: 1.5rem;
  }

  .home-divider {
    height: 1px;
    background: var(--alexi-neutral-200);
  }

  /* Loading state */
  .home-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--alexi-neutral-500);
  }

  .home-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--alexi-neutral-200);
    border-top-color: var(--alexi-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty state */
  .home-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
  }

  .home-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.7;
  }

  .home-empty-title {
    font-family: "Fredoka", system-ui, sans-serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--alexi-neutral-700);
    margin-bottom: 0.25rem;
  }

  .home-empty-subtitle {
    font-size: 0.875rem;
    color: var(--alexi-neutral-500);
  }

  /* Stats bar */
  .home-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--alexi-neutral-500);
    background: var(--alexi-neutral-50);
    border-bottom: 1px solid var(--alexi-neutral-200);
  }

  .home-stats-dot {
    color: var(--alexi-neutral-300);
  }

  .home-stats-completed {
    color: var(--alexi-primary-600);
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
    border-bottom: 1px solid var(--alexi-neutral-100);
    transition: background-color 150ms ease;
  }

  .todo-item:hover {
    background-color: var(--alexi-neutral-50);
  }

  .todo-item-last {
    border-bottom: none;
  }

  .todo-text {
    flex: 1;
    font-size: 1rem;
    color: var(--alexi-neutral-800);
    transition: all 150ms ease;
  }

  .todo-item-completed .todo-text {
    text-decoration: line-through;
    color: var(--alexi-neutral-400);
  }

  /* Footer */
  .home-footer {
    margin-top: 2rem;
    font-size: 0.75rem;
    color: var(--alexi-neutral-400);
  }

  .home-footer-link {
    color: var(--alexi-primary-600);
    font-weight: 600;
  }

  /* =========================================================================
     DARK MODE
     ========================================================================= */

  @media (prefers-color-scheme: dark) {
    .home-title {
      color: var(--alexi-neutral-100);
    }

    .home-subtitle {
      color: var(--alexi-neutral-500);
    }

    .home-card {
      background: var(--alexi-neutral-800);
      border-color: var(--alexi-neutral-700);
      box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.2),
        0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }

    .home-divider {
      background: var(--alexi-neutral-700);
    }

    .home-loading {
      color: var(--alexi-neutral-400);
    }

    .home-loading-spinner {
      border-color: var(--alexi-neutral-700);
      border-top-color: var(--alexi-primary-400);
    }

    .home-empty-title {
      color: var(--alexi-neutral-200);
    }

    .home-empty-subtitle {
      color: var(--alexi-neutral-500);
    }

    .home-stats {
      background: var(--alexi-neutral-900);
      border-bottom-color: var(--alexi-neutral-700);
      color: var(--alexi-neutral-400);
    }

    .home-stats-dot {
      color: var(--alexi-neutral-600);
    }

    .home-stats-completed {
      color: var(--alexi-primary-400);
    }

    .todo-item {
      border-bottom-color: var(--alexi-neutral-700);
    }

    .todo-item:hover {
      background-color: var(--alexi-neutral-700);
    }

    .todo-text {
      color: var(--alexi-neutral-100);
    }

    .todo-item-completed .todo-text {
      color: var(--alexi-neutral-500);
    }

    .home-footer {
      color: var(--alexi-neutral-500);
    }

    .home-footer-link {
      color: var(--alexi-primary-400);
    }
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
