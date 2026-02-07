const todoInput = document.getElementById('todo-input');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const itemsLeft = document.getElementById('items-left');
const clearCompleted = document.getElementById('clear-completed');
const filters = document.querySelectorAll('[data-filter]');

let todos = [];
let currentFilter = 'active';

function createTodoItem(text) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now()
  };
}

async function persistTodos() {
  await window.todoStorage.save(todos);
}

function getVisibleTodos() {
  if (currentFilter === 'active') return todos.filter((todo) => !todo.completed);
  if (currentFilter === 'completed') return todos.filter((todo) => todo.completed);
  return todos;
}

function updateStats() {
  const activeCount = todos.filter((todo) => !todo.completed).length;
  itemsLeft.textContent = `${activeCount} item${activeCount === 1 ? '' : 's'} left`;
}

function updateEmptyState() {
  const visibleTodos = getVisibleTodos();
  emptyState.hidden = visibleTodos.length !== 0;
}

function updateFilterButtons() {
  filters.forEach((button) => {
    const selected = button.dataset.filter === currentFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected.toString());
  });
}

function renderTodos() {
  todoList.innerHTML = '';

  const visibleTodos = getVisibleTodos();

  visibleTodos
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((todo) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', `Mark ${todo.text} as complete`);
      checkbox.addEventListener('change', async () => {
        const target = todos.find((item) => item.id === todo.id);
        if (!target) return;
        target.completed = checkbox.checked;
        await persistTodos();
        renderTodos();
      });

      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;
      text.title = 'Double click to edit';
      text.addEventListener('dblclick', () => makeEditable(text, todo.id));

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async () => {
        todos = todos.filter((item) => item.id !== todo.id);
        await persistTodos();
        renderTodos();
      });

      li.append(checkbox, text, deleteButton);
      todoList.appendChild(li);
    });

  updateStats();
  updateEmptyState();
  updateFilterButtons();
}

function makeEditable(textNode, todoId) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = textNode.textContent;
  input.className = 'edit-input';

  const commit = async () => {
    const updated = input.value.trim();
    if (!updated) {
      todos = todos.filter((todo) => todo.id !== todoId);
    } else {
      const target = todos.find((todo) => todo.id === todoId);
      if (target) target.text = updated;
    }
    await persistTodos();
    renderTodos();
  };

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') await commit();
    if (event.key === 'Escape') renderTodos();
  });

  input.addEventListener('blur', () => {
    commit();
  });

  textNode.replaceWith(input);
  input.focus();
  input.select();
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  todos.push(createTodoItem(text));
  todoInput.value = '';
  await persistTodos();
  renderTodos();
}

addButton.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    await addTodo();
  }
});

clearCompleted.addEventListener('click', async () => {
  todos = todos.filter((todo) => !todo.completed);
  await persistTodos();
  renderTodos();
});

filters.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    renderTodos();
  });
});

async function init() {
  try {
    todos = await window.todoStorage.load();
    if (!Array.isArray(todos)) todos = [];
  } catch (_error) {
    todos = [];
  }
  renderTodos();
}

init();
