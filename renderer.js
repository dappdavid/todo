const board = document.getElementById('board');
const addColumnBtn = document.getElementById('add-column-btn');

// Theme Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIconSun = themeToggleBtn.querySelector('.theme-icon-sun');
const themeIconMoon = themeToggleBtn.querySelector('.theme-icon-moon');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const columnModal = document.getElementById('column-modal');
const columnInput = document.getElementById('column-input');
const columnSaveBtn = document.getElementById('column-save-btn');
const columnCancelBtn = document.getElementById('column-cancel-btn');

const taskModal = document.getElementById('task-modal');
const taskTitleInput = document.getElementById('task-title-input');
const taskDescInput = document.getElementById('task-desc-input');
const taskSaveBtn = document.getElementById('task-save-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');
const taskDeleteBtn = document.getElementById('task-delete-btn');

const deleteModal = document.getElementById('delete-modal');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

let data = {
  columns: [],
  tasks: []
};

// Drag and Drop State
let draggedType = null;
let draggedId = null;

// Modal State
let currentEditingTaskId = null;
let currentTargetColumnId = null;
let itemToDelete = null; // { type: 'task', id: '...' }

// Theme Logic
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  if (theme === 'light') {
    themeIconSun.style.display = 'none';
    themeIconMoon.style.display = 'block';
  } else {
    themeIconSun.style.display = 'block';
    themeIconMoon.style.display = 'none';
  }
}

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
});

const defaultColumns = [
  { id: 'new', title: 'New' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'done', title: 'Done' }
];

function createTodoItem(text, description, columnId) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    description: description || '',
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

  colEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('.task-card') || e.target.closest('button') || e.target.closest('.icon-btn')) return;
    openTaskModal(null, column.id);
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

  const headerActions = document.createElement('div');
  headerActions.style.display = 'flex';
  headerActions.style.alignItems = 'center';
  headerActions.style.gap = '8px';

  const deleteColBtn = document.createElement('button');
  deleteColBtn.className = 'icon-btn';
  deleteColBtn.innerHTML = '&times;';
  deleteColBtn.title = 'Delete Column';
  deleteColBtn.onclick = (e) => {
    e.stopPropagation();
    promptDeleteColumn(column.id);
  };

  headerActions.append(countBadge, deleteColBtn);
  header.append(title, headerActions);
  colEl.appendChild(header);

  // Task List
  const taskList = document.createElement('div');
  taskList.className = 'task-list';
  taskList.dataset.columnId = column.id;

  // Crucial: Handle dragover on the list to allow dropping even if hovering over other cards
  taskList.addEventListener('dragover', (e) => {
    if (draggedType === 'task') {
      e.preventDefault();
      e.stopPropagation(); // Stop bubbling to column
      e.dataTransfer.dropEffect = 'move';
      taskList.classList.add('drag-over');

      const afterElement = getDragAfterElement(taskList, e.clientY);
      const draggable = document.querySelector('.dragging');
      if (draggable) {
        if (afterElement == null) {
          taskList.appendChild(draggable);
        } else {
          taskList.insertBefore(draggable, afterElement);
        }
      }
    }
  });

  taskList.addEventListener('dragleave', () => {
    taskList.classList.remove('drag-over');
  });

  taskList.addEventListener('drop', async (e) => {
    if (draggedType === 'task') {
      e.preventDefault();
      e.stopPropagation();
      taskList.classList.remove('drag-over');

      // Update Order and Column for ALL tasks based on DOM
      const allColumns = document.querySelectorAll('.column');
      let tasksUpdated = false;

      allColumns.forEach(col => {
        const colId = col.dataset.id;
        const cards = [...col.querySelectorAll('.task-card')];

        cards.forEach((card, index) => {
          const taskId = card.dataset.id;
          const task = data.tasks.find(t => t.id === taskId);
          if (task) {
             // Update if changed
             if (task.columnId !== colId || task.order !== index) {
               task.columnId = colId;
               task.order = index;
               tasksUpdated = true;
             }
          }
        });
      });

      if (tasksUpdated) {
        await persistData();
        renderBoard();
      }
    }
  });

  const columnTasks = data.tasks
    .filter(t => t.columnId === column.id)
    .sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.createdAt - b.createdAt;
    });

  columnTasks.forEach(task => {
    taskList.appendChild(renderTask(task));
  });

  colEl.appendChild(taskList);

  // Add Task Button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-task-btn';
  addBtn.textContent = '+ Add a card';
  addBtn.onclick = () => {
    openTaskModal(null, column.id);
  };
  colEl.appendChild(addBtn);

  return colEl;
}

function renderTask(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.draggable = true;

  // Prevent pointer events on children during drag to avoid interference
  // But we need to handle dragstart on the card itself.

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

  // Clicking opens details
  card.onclick = () => {
    openTaskModal(task);
  };

  const content = document.createElement('div');
  content.className = 'task-content';
  content.textContent = task.text;

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.title = 'Delete';
  deleteBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent opening modal
    promptDeleteTask(task.id);
  };

  actions.appendChild(deleteBtn);
  card.append(content, actions);

  return card;
}

// --- Logic ---

async function addTask(text, description, columnId) {
  if (!text.trim()) return;

  const colTasks = data.tasks.filter(t => t.columnId === columnId);
  const maxOrder = colTasks.length > 0
    ? Math.max(...colTasks.map(t => t.order !== undefined ? t.order : -1))
    : -1;

  const task = createTodoItem(text, description, columnId);
  task.order = maxOrder + 1;

  data.tasks.push(task);
  await persistData();
  renderBoard();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateTask(taskId, text, description) {
  const task = data.tasks.find(t => t.id === taskId);
  if (task) {
    task.text = text.trim();
    task.description = description || '';
    await persistData();
    renderBoard();
  }
}

async function deleteTask(taskId) {
  data.tasks = data.tasks.filter(t => t.id !== taskId);
  await persistData();
  renderBoard();
}

async function deleteColumn(columnId) {
  data.columns = data.columns.filter(c => c.id !== columnId);
  data.tasks = data.tasks.filter(t => t.columnId !== columnId);
  await persistData();
  renderBoard();
}

// --- Modals ---

function showModalOverlay(show) {
  if (show) {
    modalOverlay.classList.remove('hidden');
  } else {
    modalOverlay.classList.add('hidden');
    // Hide all modals
    columnModal.classList.add('hidden');
    taskModal.classList.add('hidden');
    deleteModal.classList.add('hidden');
  }
}

// Column Modal
addColumnBtn.addEventListener('click', () => {
  columnInput.value = '';
  showModalOverlay(true);
  columnModal.classList.remove('hidden');
  columnInput.focus();
});

columnCancelBtn.addEventListener('click', () => showModalOverlay(false));

columnInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    columnSaveBtn.click();
  }
});

columnSaveBtn.addEventListener('click', async () => {
  const title = columnInput.value.trim();
  if (title) {
    const newCol = {
      id: crypto.randomUUID(),
      title: title
    };
    data.columns.push(newCol);
    await persistData();
    renderBoard();
    showModalOverlay(false);
  }
});

// Task Modal
function openTaskModal(task = null, columnId = null) {
  showModalOverlay(true);
  taskModal.classList.remove('hidden');

  if (task) {
    // Edit Mode
    currentEditingTaskId = task.id;
    currentTargetColumnId = null; // Not adding new
    taskTitleInput.value = task.text;
    taskDescInput.value = task.description || '';
    taskDeleteBtn.classList.remove('hidden');
    document.getElementById('task-modal-title').textContent = 'Task Details';
  } else {
    // Add Mode
    currentEditingTaskId = null;
    currentTargetColumnId = columnId;
    taskTitleInput.value = '';
    taskDescInput.value = '';
    taskDeleteBtn.classList.add('hidden');
    document.getElementById('task-modal-title').textContent = 'Add Task';
  }
  taskTitleInput.focus();
}

taskCancelBtn.addEventListener('click', () => showModalOverlay(false));

taskTitleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    taskSaveBtn.click();
  }
});

taskSaveBtn.addEventListener('click', async () => {
  const title = taskTitleInput.value.trim();
  const desc = taskDescInput.value; // Description can be anything

  if (!title) return; // Title is required

  if (currentEditingTaskId) {
    await updateTask(currentEditingTaskId, title, desc);
  } else if (currentTargetColumnId) {
    await addTask(title, desc, currentTargetColumnId);
  }
  showModalOverlay(false);
});

taskDeleteBtn.addEventListener('click', () => {
  // Close task modal and open delete confirmation
  taskModal.classList.add('hidden');
  promptDeleteTask(currentEditingTaskId);
});

// Delete Confirmation
function promptDeleteTask(taskId) {
  document.getElementById('delete-modal-text').textContent = 'Are you sure you want to delete this item?';
  itemToDelete = { type: 'task', id: taskId };
  showModalOverlay(true);
  deleteModal.classList.remove('hidden');
}

function promptDeleteColumn(columnId) {
  const taskCount = data.tasks.filter(t => t.columnId === columnId).length;
  const message = taskCount > 0
    ? 'Delete column and all its tasks?'
    : 'Delete column?';

  document.getElementById('delete-modal-text').textContent = message;
  itemToDelete = { type: 'column', id: columnId };
  showModalOverlay(true);
  deleteModal.classList.remove('hidden');
}

deleteCancelBtn.addEventListener('click', () => {
  showModalOverlay(false);
  itemToDelete = null;
});

deleteConfirmBtn.addEventListener('click', async () => {
  if (itemToDelete) {
    if (itemToDelete.type === 'task') {
      await deleteTask(itemToDelete.id);
    } else if (itemToDelete.type === 'column') {
      await deleteColumn(itemToDelete.id);
    }
  }
  showModalOverlay(false);
  itemToDelete = null;
});

// Initialization
async function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  try {
    const loaded = await window.todoStorage.load();

    if (Array.isArray(loaded)) {
      data.columns = JSON.parse(JSON.stringify(defaultColumns));
      data.tasks = loaded.map(todo => ({
        id: todo.id,
        text: todo.text,
        description: '', // Migration default
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
