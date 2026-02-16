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
 * Todo list UI component (template).
 *
 * @module ${name}-ui/templates/home
 */

import { HTMLPropsMixin, prop, ref } from "@html-props/core";
import { Div, Form, H1, Li, Span, Style, Ul } from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";
import type { QuerySet } from "@alexi/db";
import { TodoModel } from "@${name}-ui/models.ts";
import { rest } from "@${name}-ui/settings.ts";
import { DSButton } from "@${name}-ui/components/mod.ts";
import { DSInput } from "@${name}-ui/components/mod.ts";
import { DSCheckbox } from "@${name}-ui/components/mod.ts";

/**
 * Home page - displays and manages the todo list
 */
export class HomePage extends HTMLPropsMixin(HTMLElement, {
  loading: prop(false),
  todos: prop<QuerySet<TodoModel> | null>(null),
  fetch: prop<(() => Promise<void>) | null>(null),
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

  private handleSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    const input = this.inputRef.current;
    if (!input || !input.value.trim()) return;

    const title = input.value.trim();
    input.value = "";

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
      new Container({
        padding: "24px",
        style: {
          maxWidth: "600px",
          margin: "0 auto",
        },
        content: [
          new Column({
            gap: "24px",
            content: [
              this.renderHeader(),
              this.renderForm(),
              this.loading ? this.renderLoading() : this.renderTodoList(),
            ],
          }),
        ],
      }),
    ];
  }

  private renderHeader(): Node {
    return new H1({
      dataset: { key: "header" },
      textContent: "📝 Todo App",
      className: "home-title",
    });
  }

  private renderForm(): Node {
    return new Form({
      dataset: { key: "form" },
      onsubmit: this.handleSubmit,
      content: [
        new Row({
          gap: "12px",
          crossAxisAlignment: "end",
          content: [
            new Div({
              style: { flex: "1" },
              content: [
                new DSInput({
                  ref: this.inputRef,
                  placeholder: "What needs to be done?",
                  size: "md",
                }),
              ],
            }),
            new DSButton({
              type: "submit",
              variant: "primary",
              size: "md",
              content: ["Add"],
            }),
          ],
        }),
      ],
    });
  }

  private renderLoading(): Node {
    return new Div({
      dataset: { key: "loading" },
      className: "home-empty",
      textContent: "Loading...",
    });
  }

  private renderTodoList(): Node {
    const todos = this.todos?.array() ?? [];

    if (todos.length === 0) {
      return new Div({
        dataset: { key: "empty" },
        className: "home-empty",
        textContent: "No todos yet. Add one above!",
      });
    }

    return new Ul({
      dataset: { key: "todo-list" },
      className: "todo-list",
      content: todos.map((todo) => this.renderTodoItem(todo)),
    });
  }

  private renderTodoItem(todo: TodoModel): Node {
    const completed = todo.completed.get() as boolean;

    return new Li({
      dataset: { key: \`todo-\${todo.id.get()}\` },
      className: "todo-item",
      content: [
        new DSCheckbox({
          checked: completed,
          onchange: () => this.handleToggle(todo),
        }),
        new Span({
          textContent: todo.title.get() as string,
          className: completed ? "todo-text todo-completed" : "todo-text",
        }),
        new DSButton({
          variant: "ghost",
          size: "sm",
          onclick: () => this.handleDelete(todo),
          content: ["🗑️"],
        }),
      ],
    });
  }
}

// Register the custom element
HomePage.define("home-page");

/**
 * Home page styles
 */
const HOME_STYLES = \`
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap");

  :host {
    display: block;
  }

  .home-title {
    margin: 0;
    font-family: "Fredoka", system-ui, sans-serif;
    font-size: 2.5rem;
    font-weight: 600;
    text-align: center;
    color: #18181b;
  }

  .home-empty {
    text-align: center;
    color: #71717a;
    padding: 32px;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 1rem;
  }

  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid #e4e4e7;
    transition: background-color 150ms ease;
  }

  .todo-item:hover {
    background-color: #fafafa;
  }

  .todo-item:last-child {
    border-bottom: none;
  }

  .todo-text {
    flex: 1;
    font-family: "Nunito", system-ui, sans-serif;
    font-size: 1rem;
    color: #18181b;
    transition: all 150ms ease;
  }

  .todo-completed {
    text-decoration: line-through;
    color: #a1a1aa;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .home-title {
      color: #fafafa;
    }

    .home-empty {
      color: #a1a1aa;
    }

    .todo-item {
      border-bottom-color: #3f3f46;
    }

    .todo-item:hover {
      background-color: #27272a;
    }

    .todo-text {
      color: #fafafa;
    }

    .todo-completed {
      color: #71717a;
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
