import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { MarkdownRenderer } from "./markdown/renderer";
import { MarkdownPreviewPanel } from "./webview/panel";

export function activate(context: vscode.ExtensionContext) {
  const renderer = new MarkdownRenderer();
  
  // State Management
  const panelMap: Map<string, MarkdownPreviewPanel> = new Map();
  const hostScrollingPanels: Set<vscode.WebviewPanel> = new Set();
  const updateTimeoutMap: Map<string, NodeJS.Timeout> = new Map();

  async function showPreview(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const docUriString = uri.toString();

    // Determine target column (open in Column 2 if editor is in Column 1; otherwise, open in Column - 1 to be side-by-side without creating new columns)
    let targetColumn = vscode.ViewColumn.Two;
    const docEditor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === docUriString
    );

    const editorColumn = docEditor?.viewColumn || 
                         vscode.window.activeTextEditor?.viewColumn || 
                         vscode.window.tabGroups.activeTabGroup?.viewColumn;

    if (editorColumn) {
      if (editorColumn === vscode.ViewColumn.One) {
        targetColumn = vscode.ViewColumn.Two;
      } else {
        targetColumn = editorColumn - 1;
      }
    }

    if (panelMap.has(docUriString)) {
      panelMap.get(docUriString)!.reveal(targetColumn);
      return;
    }

    const docDir = path.dirname(uri.fsPath);
    const fileName = path.basename(uri.fsPath);

    const resourceRoots: vscode.Uri[] = [
      vscode.Uri.file(context.extensionPath),
      vscode.Uri.file(docDir),
      vscode.Uri.file(path.join(docDir, "..")),
      ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) || []),
    ];

    if (process.platform === "win32") {
      const docRoot = path.parse(docDir).root;
      if (docRoot && fs.existsSync(docRoot)) {
        resourceRoots.push(vscode.Uri.file(docRoot));
      }
      for (const drive of ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]) {
        const drivePath = `${drive}:\\`;
        if (fs.existsSync(drivePath)) {
          resourceRoots.push(vscode.Uri.file(drivePath));
        }
      }
    } else {
      resourceRoots.push(vscode.Uri.file("/"));
    }

    const panel = vscode.window.createWebviewPanel(
      MarkdownPreviewPanel.viewType,
      "Preview: " + fileName,
      targetColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: resourceRoots,
      }
    );

    const previewPanel = new MarkdownPreviewPanel(
      panel,
      doc,
      context,
      renderer,
      hostScrollingPanels
    );

    panelMap.set(docUriString, previewPanel);

    previewPanel.onDidDispose(() => {
      panelMap.delete(docUriString);
      const timeout = updateTimeoutMap.get(docUriString);
      if (timeout) {
        clearTimeout(timeout);
        updateTimeoutMap.delete(docUriString);
      }
    });
  }

  // Toggle Command
  const toggleCommand = vscode.commands.registerCommand(
    "mdViewer.toggleView",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") return;

      const docUriString = editor.document.uri.toString();
      if (panelMap.has(docUriString)) {
        panelMap.get(docUriString)!.dispose();
        return;
      }
      showPreview(editor.document.uri);
    }
  );

  // View Preview Command
  const viewPreviewCommand = vscode.commands.registerCommand(
    "mdViewer.viewPreview",
    (uri: vscode.Uri) => {
      if (uri) {
        showPreview(uri);
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === "markdown") {
          showPreview(editor.document.uri);
        }
      }
    }
  );

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "mdViewer.toggleView";
  statusBarItem.tooltip = "Click to Toggle Markdown Preview";
  context.subscriptions.push(statusBarItem);

  function updateStatusBarItem(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === "markdown") {
      statusBarItem.text = `$(markdown) Preview MD`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }

  // Initial update
  updateStatusBarItem();

  let lastSyncTime = 0;
  let syncTimeout: NodeJS.Timeout | null = null;
  const hostScrollThrottleMs = 30; // Smooth 33fps limit for scrolling sync

  function syncPreviewScroll(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== "markdown") {
      return;
    }
    const uriStr = editor.document.uri.toString();
    if (!panelMap.has(uriStr)) {
      return;
    }
    const previewPanel = panelMap.get(uriStr)!;

    if (hostScrollingPanels.has(previewPanel.webviewPanel)) {
      return;
    }

    const now = Date.now();
    if (now - lastSyncTime >= hostScrollThrottleMs) {
      lastSyncTime = now;
      const visibleLine = editor.visibleRanges[0]?.start.line || 0;
      previewPanel.postMessage({ command: "scrollToLine", line: visibleLine });
    } else {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(() => {
        if (hostScrollingPanels.has(previewPanel.webviewPanel)) {
          return;
        }
        lastSyncTime = Date.now();
        const visibleLine = editor.visibleRanges[0]?.start.line || 0;
        previewPanel.postMessage({
          command: "scrollToLine",
          line: visibleLine,
        });
      }, hostScrollThrottleMs);
    }
  }

  function syncPreviewSelection(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== "markdown") {
      return;
    }
    const uriStr = editor.document.uri.toString();
    if (!panelMap.has(uriStr)) {
      return;
    }
    const previewPanel = panelMap.get(uriStr)!;

    const config = vscode.workspace.getConfiguration("mdViewer.preview");
    if (!config.get<boolean>("syncSelection", true)) {
      return;
    }

    if (previewPanel.isSyncingSelection) {
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      previewPanel.postMessage({
        command: "selectLines",
        startLine: -1,
        endLine: -1
      });
      return;
    }

    previewPanel.postMessage({
      command: "selectLines",
      startLine: selection.start.line,
      endLine: selection.end.line
    });
  }

  // Listeners mapping for Scroll Sync & Status Bar
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      updateStatusBarItem();
      syncPreviewScroll(editor);
      syncPreviewSelection(editor);
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorSelection(
    (e) => {
      syncPreviewSelection(e.textEditor);
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorVisibleRanges(
    (e) => {
      syncPreviewScroll(e.textEditor);
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidOpenTextDocument(
    updateStatusBarItem,
    null,
    context.subscriptions
  );

  // Debounced Incremental Text Update mapping
  vscode.workspace.onDidChangeTextDocument(
    (e) => {
      if (e.document.languageId === "markdown") {
        const uriStr = e.document.uri.toString();
        if (panelMap.has(uriStr)) {
          const activeTimeout = updateTimeoutMap.get(uriStr);
          if (activeTimeout) {
            clearTimeout(activeTimeout);
          }
          const timeout = setTimeout(() => {
            panelMap.get(uriStr)!.update(false);
            updateTimeoutMap.delete(uriStr);
          }, 150); // 150ms typing performance debounce
          updateTimeoutMap.set(uriStr, timeout);
        }
      }
    },
    null,
    context.subscriptions
  );

  context.subscriptions.push(toggleCommand, viewPreviewCommand);
}

export function deactivate() {}
