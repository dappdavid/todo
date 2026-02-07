# Electron Todo App (Windows-friendly)

A simple desktop todo app built with ElectronJS. It runs locally and persists todos to disk so your tasks are still there after relaunch.

## Features

- Add todos
- Mark todos completed / active
- Edit a todo (double-click)
- Delete a todo
- Filter by All / Active / Completed
- Clear all completed todos
- Local persistence (saved in Electron `userData` directory)

## Requirements

- Node.js 18+ (LTS recommended)
- npm 9+
- Windows 10/11 (also works on macOS/Linux)

## 1) Install dependencies

```bash
npm install
```

## 2) Run locally (development)

```bash
npm start
```

This opens the Electron window for the todo app.

## 3) Verify syntax checks

```bash
npm test
```

## Data location (local persistence)

Todos are saved as JSON in Electron's user data folder:

- Windows: `%APPDATA%/<app-name>/todos.json` (resolved by Electron at runtime)

In this project, the file is created by `main.js` using `app.getPath('userData')`.

## Build notes

This repository includes a runnable local app. If you want an installer/exe, add a packager such as `electron-builder` or `electron-forge` and configure build targets.

For now, local launch is:

```bash
npm install
npm start
```
