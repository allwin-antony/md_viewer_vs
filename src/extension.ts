import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// Use require for CommonJS modules that don't have proper TS typings
const MarkdownIt = require("markdown-it");
const markdownItTaskLists = require("markdown-it-task-lists");
const markdownItEmoji = require("markdown-it-emoji");
const hljs = require("highlight.js");

export function activate(context: vscode.ExtensionContext) {
  function slugify(s: string): string {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  // 1. Minimal markdown-it config
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight: function (str: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' + hljs.highlight(str, { language: lang, ignoreIllegals: true }).value + "</code></pre>";
        } catch (__) {}
      }
      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + "</code></pre>";
    },
  });

  // Basic math preservation to prevent markdown-it from mangling _ and *
  function math_inline(state: any, silent: boolean) {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
    let end = -1;
    let pos = start + 1;
    while (pos < state.src.length) {
      if (state.src.charCodeAt(pos) === 0x24) { end = pos; break; }
      if (state.src.charCodeAt(pos) === 0x5c /* \ */) pos++;
      pos++;
    }
    if (end === -1) return false;
    if (!silent) {
      const token = state.push('text', '', 0);
      token.content = state.src.slice(start, end + 1);
    }
    state.pos = end + 1;
    return true;
  }
  
  function math_block(state: any, startLine: number, endLine: number, silent: boolean) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(start, start + 2) !== '$$') return false;
    if (silent) return true;
    let nextLine = startLine;
    let endLineFound = false;
    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      if (state.src.slice(pos, pos + 2) === '$$') { endLineFound = true; break; }
    }
    if (!endLineFound) return false;
    const token = state.push('html_block', '', 0);
    token.content = '<div class="math-block">' + md.utils.escapeHtml(state.getLines(startLine, nextLine + 1, state.blkIndent, true)) + '</div>';
    state.line = nextLine + 1;
    return true;
  }
  md.inline.ruler.before('escape', 'math_inline', math_inline);
  md.block.ruler.before('fence', 'math_block', math_block);

  md.renderer.rules.heading_open = function (tokens: any[], idx: number, options: any, env: any, self: any) {
    const token = tokens[idx];
    const contentToken = tokens[idx + 1];
    if (contentToken && contentToken.children) {
      const text = contentToken.children.filter((t: any) => t.type === "text" || t.type === "code_inline").map((t: any) => t.content).join("");
      token.attrSet("id", slugify(text));
    }
    return self.renderToken(tokens, idx, options);
  };

  md.use(markdownItTaskLists, { enabled: true, label: true });
  md.use(markdownItEmoji.full);

  const defaultFence = md.renderer.rules.fence || function (tokens: any[], idx: number, options: any, env: any, self: any) { return self.renderToken(tokens, idx, options); };
  md.renderer.rules.fence = function (tokens: any[], idx: number, options: any, env: any, self: any) {
    const token = tokens[idx];
    const info = (token.info || "").trim();
    if (info.startsWith("mermaid")) {
      return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  // State Management & Caching
  const panelMap: Map<string, vscode.WebviewPanel> = new Map();
  const htmlCache: Map<string, { hash: string, html: string }> = new Map();
  const imageCache: Map<string, string> = new Map();

  function getHash(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
  }

  function resolveLocalImages(html: string, docDir: string, webview: vscode.Webview): string {
    return html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi, (match, pre, src, post) => {
      if (/^(https?:|data:|vscode-resource:)/i.test(src)) return match;
      const decodedSrc = decodeURIComponent(src);
      const cacheKey = docDir + "|" + decodedSrc;
      if (imageCache.has(cacheKey)) {
        return `<img ${pre}src="${imageCache.get(cacheKey)}"${post}>`;
      }
      const absolutePath = path.isAbsolute(decodedSrc) ? decodedSrc : path.resolve(docDir, decodedSrc);
      if (fs.existsSync(absolutePath)) {
        const webviewUri = webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
        imageCache.set(cacheKey, webviewUri);
        return `<img ${pre}src="${webviewUri}"${post}>`;
      }
      return match;
    });
  }

  function updatePanel(doc: vscode.TextDocument, panel: vscode.WebviewPanel, initial: boolean = false) {
    const text = doc.getText();
    const hash = getHash(text);
    const uriString = doc.uri.toString();
    
    // Cache check
    let htmlContent = "";
    if (htmlCache.has(uriString) && htmlCache.get(uriString)!.hash === hash) {
      htmlContent = htmlCache.get(uriString)!.html;
    } else {
      let rendered = md.render(text);
      const docDir = path.dirname(doc.uri.fsPath);
      rendered = resolveLocalImages(rendered, docDir, panel.webview);
      htmlContent = rendered;
      htmlCache.set(uriString, { hash, html: htmlContent });
    }

    if (initial) {
      panel.webview.html = getWebviewContent(htmlContent);
    } else {
      panel.webview.postMessage({ command: "update", body: htmlContent });
    }
  }

  async function showPreview(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const docUriString = uri.toString();

    if (panelMap.has(docUriString)) {
      panelMap.get(docUriString)!.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const docDir = path.dirname(uri.fsPath);
    const fileName = path.basename(uri.fsPath);

    const panel = vscode.window.createWebviewPanel(
      "mdViewer",
      "Preview: " + fileName,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.file(docDir),
          ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) || []),
          vscode.Uri.file(path.join(docDir, "..")),
        ],
      }
    );

    updatePanel(doc, panel, true);

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "openExternal":
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        case "openRelative":
          let filePath = message.url;
          const hashIdx = filePath.indexOf("#");
          if (hashIdx !== -1) filePath = filePath.substring(0, hashIdx);
          const decodedPath = decodeURIComponent(filePath);
          const absolutePath = path.isAbsolute(decodedPath) ? decodedPath : path.resolve(docDir, decodedPath);
          if (fs.existsSync(absolutePath)) {
            vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath)).then((doc) => {
              vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
            });
          }
          break;
      }
    }, undefined, context.subscriptions);

    panelMap.set(docUriString, panel);
    panel.onDidDispose(() => {
      panelMap.delete(docUriString);
      htmlCache.delete(docUriString);
    }, null, context.subscriptions);
  }

  const toggleCommand = vscode.commands.registerCommand("mdViewer.toggleView", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") return;

    const docUriString = editor.document.uri.toString();
    if (panelMap.has(docUriString)) {
      panelMap.get(docUriString)!.dispose();
      return;
    }
    showPreview(editor.document.uri);
  });

  const viewPreviewCommand = vscode.commands.registerCommand("mdViewer.viewPreview", (uri: vscode.Uri) => {
    if (uri) {
      showPreview(uri);
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === "markdown") {
        showPreview(editor.document.uri);
      }
    }
  });

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
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

  // Listen for editor changes to show/hide status bar item
  vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem, null, context.subscriptions);
  vscode.workspace.onDidOpenTextDocument(updateStatusBarItem, null, context.subscriptions);

  context.subscriptions.push(toggleCommand, viewPreviewCommand);

  // Live updates via postMessage
  vscode.workspace.onDidChangeTextDocument(e => {
    if (e.document.languageId === "markdown") {
      const uriStr = e.document.uri.toString();
      if (panelMap.has(uriStr)) {
        updatePanel(e.document, panelMap.get(uriStr)!, false);
      }
    }
  }, null, context.subscriptions);

  context.subscriptions.push(toggleCommand);
}

function getWebviewContent(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <!-- Leaner, optimized CSS -->
    <style>
        :root { --content-max-width: 960px; }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px 32px;
            line-height: 1.7;
            max-width: var(--content-max-width);
            margin: 0 auto;
            word-wrap: break-word;
        }
        h1, h2, h3, h4, h5, h6 { margin-top: 28px; margin-bottom: 16px; font-weight: 600; line-height: 1.3; }
        h1 { font-size: 2em; border-bottom: 2px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
        a { color: var(--vscode-textLink-foreground); text-decoration: none; }
        a:hover { text-decoration: underline; }
        pre { background-color: var(--vscode-textCodeBlock-background); padding: 16px; border-radius: 6px; overflow: auto; }
        code { font-family: 'Fira Code', 'Cascadia Code', monospace; background-color: var(--vscode-textCodeBlock-background); padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
        pre code { padding: 0; background-color: transparent; }
        img { max-width: 100%; height: auto; border-radius: 6px; }
        blockquote { border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 4px 16px; color: var(--vscode-textBlockQuote-foreground); margin: 0 0 16px 0; background-color: rgba(128,128,128,0.05); }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; display: block; overflow-x: auto; }
        th, td { border: 1px solid var(--vscode-panel-border); padding: 8px 14px; text-align: left; }
        th { background-color: var(--vscode-textCodeBlock-background); font-weight: 600; }
        tr:nth-child(even) { background-color: rgba(128, 128, 128, 0.05); }
        .task-list-item { list-style-type: none; margin-left: -1.5em; }
        /* KaTeX overrides */
        .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; text-align: center; }
        html { scroll-behavior: smooth; }
        ::selection { background-color: var(--vscode-editor-selectionBackground); }
    </style>
    <!-- KaTeX CSS & Client JS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
</head>
<body>
    <div id="content">${body}</div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();

        function renderMathAndMermaid() {
            // KaTeX Auto Render (Client-side)
            renderMathInElement(document.getElementById('content'), {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\\\[', right: '\\\\]', display: true},
                    {left: '\\\\(', right: '\\\\)', display: false}
                ],
                throwOnError: false
            });

            // Mermaid Init (Client-side)
            if (window.mermaid) {
                mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
                const mermaidBlocks = document.querySelectorAll('.mermaid');
                mermaidBlocks.forEach(el => mermaid.init(undefined, el));
            }
        }

        // Initial render
        renderMathAndMermaid();

        // Listen for live incremental updates
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                document.getElementById('content').innerHTML = message.body;
                renderMathAndMermaid();
            }
        });

        // Click handler
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a');
            if (!target) return;
            const href = target.getAttribute('href');
            if (!href) return;

            if (href.startsWith('#')) {
                e.preventDefault();
                e.stopPropagation();
                const id = href.substring(1);
                let el = document.getElementById(id) || document.getElementById(id.replace(/^-+|-+$/g, ''));
                if (el) {
                    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }
                return;
            }

            if (href.startsWith('http://') || href.startsWith('https://')) {
                e.preventDefault();
                vscode.postMessage({ command: 'openExternal', url: href });
                return;
            }

            if (!href.startsWith('mailto:')) {
                e.preventDefault();
                vscode.postMessage({ command: 'openRelative', url: href });
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() {}
