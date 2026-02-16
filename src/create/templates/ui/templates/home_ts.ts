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
import { Button, Div, Form, H1, Input, Li, Span, Ul } from "@html-props/built-ins";
import { Column, Container, Row } from "@html-props/layout";
import type { QuerySet } from "@alexi/db";
import { TodoModel } from "@${name}-ui/models.ts";
import { sync } from "@${name}-ui/settings.ts";

/**
 * Home page - displays and manages the todo list
 */
export class HomePage extends HTMLPropsMixin(HTMLElement, {
  loading: prop(false),
  todos: prop<QuerySet<TodoModel> | null>(null),
  fetch: prop<(() => Promise<void>) | null>(null),
}) {
  private inputRef = ref<HTMLInputElement>(null);

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

    // Create new todo via sync backend
    await TodoModel.objects.using("sync").create({
      title,
      completed: false,
    });

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  private handleToggle = async (todo: TodoModel): Promise<void> => {
    todo.toggle();
    await sync.update(todo);

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  private handleDelete = async (todo: TodoModel): Promise<void> => {
    await sync.delete(todo);

    // Refresh the list
    if (this.fetch) {
      await this.fetch();
    }
  };

  override render(): Node {
    return new Container({
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
    });
  }

  private renderHeader(): Node {
    return new H1({
      dataset: { key: "header" },
      textContent: "📝 Todo App",
      style: {
        margin: "0",
        fontSize: "2rem",
        textAlign: "center",
      },
    });
  }

  private renderForm(): Node {
    return new Form({
      dataset: { key: "form" },
      onsubmit: this.handleSubmit,
      content: [
        new Row({
          gap: "8px",
          content: [
            new Input({
              ref: this.inputRef,
              type: "text",
              placeholder: "What needs to be done?",
              style: {
                flex: "1",
                padding: "12px",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              },
            }),
            new Button({
              type: "submit",
              textContent: "Add",
              style: {
                padding: "12px 24px",
                fontSize: "1rem",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              },
            }),
          ],
        }),
      ],
    });
  }

  private renderLoading(): Node {
    return new Div({
      dataset: { key: "loading" },
      textContent: "Loading...",
      style: {
        textAlign: "center",
        color: "#666",
        padding: "24px",
      },
    });
  }

  private renderTodoList(): Node {
    const todos = this.todos?.array() ?? [];

    if (todos.length === 0) {
      return new Div({
        dataset: { key: "empty" },
        textContent: "No todos yet. Add one above!",
        style: {
          textAlign: "center",
          color: "#666",
          padding: "24px",
        },
      });
    }

    return new Ul({
      dataset: { key: "todo-list" },
      style: {
        listStyle: "none",
        padding: "0",
        margin: "0",
      },
      content: todos.map((todo) => this.renderTodoItem(todo)),
    });
  }

  private renderTodoItem(todo: TodoModel): Node {
    const completed = todo.completed.get() as boolean;

    return new Li({
      dataset: { key: \`todo-\${todo.id.get()}\` },
      style: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        borderBottom: "1px solid #eee",
      },
      content: [
        new Input({
          type: "checkbox",
          checked: completed,
          onchange: () => this.handleToggle(todo),
          style: {
            width: "20px",
            height: "20px",
            cursor: "pointer",
          },
        }),
        new Span({
          textContent: todo.title.get() as string,
          style: {
            flex: "1",
            textDecoration: completed ? "line-through" : "none",
            color: completed ? "#999" : "#333",
          },
        }),
        new Button({
          textContent: "🗑️",
          onclick: () => this.handleDelete(todo),
          style: {
            padding: "4px 8px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "1rem",
          },
        }),
      ],
    });
  }
}

// Register the custom element
HomePage.define("home-page");
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
