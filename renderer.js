const board = document.getElementById('board');
const addColumnBtn = document.getElementById('add-column-btn');

let data = {
  columns: [],
  tasks: []
};

// Drag and Drop State
let draggedType = null;
let draggedId = null;

const defaultColumns = [
  { id: 'new', title: 'New' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'done', title: 'Done' }
];

function createTodoItem(text, columnId) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    columnId: columnId,
    createdAt: Date.now()
  };
}

async function persistData() {
  await window.todoStorage.save(data);
}

function renderBoard() {
  board.innerHTML = '';
  data.columns.forEach(column => {
    const columnEl = renderColumn(column);
    board.appendChild(columnEl);
  });
}

function renderColumn(column) {
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.id = column.id;
  colEl.draggable = true;

  // Column Drag Events
  colEl.addEventListener('dragstart', (e) => {
    if (draggedType === 'task') return;

    e.stopPropagation();
    draggedType = 'column';
    draggedId = column.id;
    colEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column.id);
  });

  colEl.addEventListener('dragend', () => {
    colEl.classList.remove('dragging');
    draggedType = null;
    draggedId = null;
  });

  colEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedType === 'column') {
       e.dataTransfer.dropEffect = 'move';
    }
  });

  colEl.addEventListener('drop', async (e) => {
    if (draggedType === 'column' && draggedId !== column.id) {
       e.preventDefault();
       e.stopPropagation();

       const oldIndex = data.columns.findIndex(c => c.id === draggedId);
       const newIndex = data.columns.findIndex(c => c.id === column.id);

       if (oldIndex > -1 && newIndex > -1) {
         const [moved] = data.columns.splice(oldIndex, 1);
         data.columns.splice(newIndex, 0, moved);
         await persistData();
         renderBoard();
       }
    }
  });

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';

  const title = document.createElement('span');
  title.className = 'column-title';
  title.textContent = column.title;

  const taskCount = data.tasks.filter(t => t.columnId === column.id).length;
  const countBadge = document.createElement('span');
  countBadge.textContent = taskCount;
  countBadge.style.opacity = '0.5';
  countBadge.style.fontSize = '0.9em';
  countBadge.style.marginLeft = '8px';

  header.append(title, countBadge);
  colEl.appendChild(header);

  // Task List
  const taskList = document.createElement('div');
  taskList.className = 'task-list';
  taskList.dataset.columnId = column.id;

  taskList.addEventListener('dragover', (e) => {
    if (draggedType === 'task') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      taskList.style.backgroundColor = 'rgba(0,0,0,0.03)';
    }
  });

  taskList.addEventListener('dragleave', () => {
    taskList.style.backgroundColor = '';
  });

  taskList.addEventListener('drop', async (e) => {
    if (draggedType === 'task') {
      e.preventDefault();
      e.stopPropagation();
      taskList.style.backgroundColor = '';

      const task = data.tasks.find(t => t.id === draggedId);
      if (task && task.columnId !== column.id) {
        task.columnId = column.id;
        await persistData();
        renderBoard();
      }
    }
  });

  const columnTasks = data.tasks
    .filter(t => t.columnId === column.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  columnTasks.forEach(task => {
    taskList.appendChild(renderTask(task));
  });

  colEl.appendChild(taskList);

  // Add Task Button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-task-btn';
  addBtn.textContent = '+ Add a card';
  addBtn.onclick = () => {
    const text = prompt('Enter task description:');
    if (text) {
      addTask(text, column.id);
    }
  };
  colEl.appendChild(addBtn);

  return colEl;
}

function renderTask(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    draggedType = 'task';
    draggedId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedType = null;
    draggedId = null;
  });

  const content = document.createElement('div');
  content.className = 'task-content';
  content.textContent = task.text;
  content.title = 'Double click to edit';

  content.addEventListener('dblclick', () => makeEditable(content, task.id));

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.title = 'Delete';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  };

  actions.appendChild(deleteBtn);
  card.append(content, actions);

  return card;
}

async function addTask(text, columnId) {
  if (!text.trim()) return;
  const task = createTodoItem(text, columnId);
  data.tasks.push(task);
  await persistData();
  renderBoard();
}

async function deleteTask(taskId) {
  data.tasks = data.tasks.filter(t => t.id !== taskId);
  await persistData();
  renderBoard();
}

function makeEditable(textNode, taskId) {
  const currentText = textNode.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'edit-input';
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';

  const commit = async () => {
    const updated = input.value.trim();
    if (updated && updated !== currentText) {
      const task = data.tasks.find(t => t.id === taskId);
      if (task) {
        task.text = updated;
        await persistData();
      }
    } else if (!updated) {
       await deleteTask(taskId);
       return;
    }
    renderBoard();
  };

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        input.blur();
    }
    if (event.key === 'Escape') {
        renderBoard();
    }
  });

  input.addEventListener('blur', () => {
    commit();
  });

  textNode.replaceWith(input);
  input.focus();
  input.select();
}

addColumnBtn.addEventListener('click', async () => {
  const title = prompt('Enter column title:');
  if (title && title.trim()) {
    const newCol = {
      id: crypto.randomUUID(),
      title: title.trim()
    };
    data.columns.push(newCol);
    await persistData();
    renderBoard();
  }
});

async function init() {
  try {
    const loaded = await window.todoStorage.load();

    if (Array.isArray(loaded)) {
      data.columns = JSON.parse(JSON.stringify(defaultColumns));
      data.tasks = loaded.map(todo => ({
        id: todo.id,
        text: todo.text,
        createdAt: todo.createdAt || Date.now(),
        columnId: todo.completed ? 'done' : 'new'
      }));
      await persistData();
    } else if (loaded && loaded.columns && Array.isArray(loaded.columns)) {
      data = loaded;
      if (!Array.isArray(data.tasks)) data.tasks = [];
    } else {
      data.columns = JSON.parse(JSON.stringify(defaultColumns));
      data.tasks = [];
      await persistData();
    }
  } catch (error) {
    console.error('Error loading data:', error);
    data.columns = JSON.parse(JSON.stringify(defaultColumns));
    data.tasks = [];
  }

  renderBoard();
}

init();
