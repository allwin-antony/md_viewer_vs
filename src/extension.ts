import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as cp from "child_process";

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
          return (
            '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true })
              .value +
            "</code></pre>"
          );
        } catch (__) {}
      }
      return (
        '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + "</code></pre>"
      );
    },
  });

  // Inject source line numbers as data-line attributes on all top-level tokens
  md.core.ruler.push("inject_line_numbers", (state: any) => {
    state.tokens.forEach((token: any) => {
      if (token.map && token.level === 0) {
        token.attrSet("data-line", token.map[0]);
      }
    });
  });

  // Basic math preservation to prevent markdown-it from mangling _ and *
  function math_inline(state: any, silent: boolean) {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
    let end = -1;
    let pos = start + 1;
    while (pos < state.src.length) {
      if (state.src.charCodeAt(pos) === 0x24) {
        end = pos;
        break;
      }
      if (state.src.charCodeAt(pos) === 0x5c /* \ */) pos++;
      pos++;
    }
    if (end === -1) return false;
    if (!silent) {
      const token = state.push("text", "", 0);
      token.content = state.src.slice(start, end + 1);
    }
    state.pos = end + 1;
    return true;
  }

  function math_block(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean,
  ) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(start, start + 2) !== "$$") return false;
    if (silent) return true;
    let nextLine = startLine;
    let endLineFound = false;
    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      if (state.src.slice(pos, pos + 2) === "$$") {
        endLineFound = true;
        break;
      }
    }
    if (!endLineFound) return false;
    const token = state.push("html_block", "", 0);
    token.content =
      `<div class="math-block" data-line="${startLine}">` +
      md.utils.escapeHtml(
        state.getLines(startLine, nextLine + 1, state.blkIndent, true),
      ) +
      "</div>";
    state.line = nextLine + 1;
    return true;
  }
  md.inline.ruler.before("escape", "math_inline", math_inline);
  md.block.ruler.before("fence", "math_block", math_block);

  md.renderer.rules.heading_open = function (
    tokens: any[],
    idx: number,
    options: any,
    env: any,
    self: any,
  ) {
    const token = tokens[idx];
    const contentToken = tokens[idx + 1];
    if (contentToken && contentToken.children) {
      const text = contentToken.children
        .filter((t: any) => t.type === "text" || t.type === "code_inline")
        .map((t: any) => t.content)
        .join("");
      token.attrSet("id", slugify(text));
    }
    return self.renderToken(tokens, idx, options);
  };

  md.use(markdownItTaskLists, { enabled: true, label: true });
  md.use(markdownItEmoji.full);

  function translateWsdToMermaid(content: string): string {
    const lines = content.split("\n");
    const mermaidLines = ["sequenceDiagram"];

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) continue;

      // Remove @startuml / @enduml if present
      if (trimmed.startsWith("@startuml") || trimmed.startsWith("@enduml")) {
        continue;
      }

      // Skip styling parameters
      if (
        trimmed.startsWith("skinparam") ||
        trimmed.startsWith("style ") ||
        trimmed.startsWith("autonumber")
      ) {
        continue;
      }

      // Title rendering
      if (trimmed.toLowerCase().startsWith("title ")) {
        continue;
      }

      // Convert arrows:
      if (trimmed.includes("-->")) {
        trimmed = trimmed.replace("-->", "-->>");
      } else if (trimmed.includes("->")) {
        trimmed = trimmed.replace("->", "->>");
      }

      mermaidLines.push("    " + trimmed);
    }

    return mermaidLines.join("\n");
  }

  const defaultFence =
    md.renderer.rules.fence ||
    function (tokens: any[], idx: number, options: any, env: any, self: any) {
      return self.renderToken(tokens, idx, options);
    };
  md.renderer.rules.fence = function (
    tokens: any[],
    idx: number,
    options: any,
    env: any,
    self: any,
  ) {
    const token = tokens[idx];
    const info = (token.info || "").trim().toLowerCase();

    // Inject source line numbers if the token has a map
    if (token.map) {
      token.attrSet("data-line", token.map[0]);
    }

    if (info.startsWith("mermaid")) {
      return `<div class="mermaid" data-line="${token.map ? token.map[0] : ""}">${md.utils.escapeHtml(token.content)}</div>`;
    }

    if (info === "wsd" || info === "websequence" || info === "sequence") {
      const translated = translateWsdToMermaid(token.content);
      return `<div class="mermaid" data-line="${token.map ? token.map[0] : ""}">${md.utils.escapeHtml(translated)}</div>`;
    }

    if (info === "uml" || info === "plantuml") {
      let content = token.content;
      content = content
        .replace(/@startuml\s*/gi, "")
        .replace(/@enduml\s*/gi, "");
      const translated = translateWsdToMermaid(content);
      return `<div class="mermaid" data-line="${token.map ? token.map[0] : ""}">${md.utils.escapeHtml(translated)}</div>`;
    }

    const rendered = defaultFence(tokens, idx, options, env, self);
    if (token.map && rendered.startsWith("<pre")) {
      return rendered.replace("<pre", `<pre data-line="${token.map[0]}"`);
    }
    return rendered;
  };

  // State Management & Caching
  const panelMap: Map<string, vscode.WebviewPanel> = new Map();
  const htmlCache: Map<string, { hash: string; html: string }> = new Map();
  const imageCache: Map<string, string> = new Map();

  function getHash(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
  }

  function resolveLocalImages(
    html: string,
    docDir: string,
    webview: vscode.Webview,
  ): string {
    return html.replace(
      /<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi,
      (match, pre, src, post) => {
        if (/^(https?:|data:|vscode-resource:)/i.test(src)) return match;
        const decodedSrc = decodeURIComponent(src);
        const cacheKey = docDir + "|" + decodedSrc;
        if (imageCache.has(cacheKey)) {
          return `<img ${pre}src="${imageCache.get(cacheKey)}"${post}>`;
        }
        const absolutePath = path.isAbsolute(decodedSrc)
          ? decodedSrc
          : path.resolve(docDir, decodedSrc);
        if (fs.existsSync(absolutePath)) {
          const webviewUri = webview
            .asWebviewUri(vscode.Uri.file(absolutePath))
            .toString();
          imageCache.set(cacheKey, webviewUri);
          return `<img ${pre}src="${webviewUri}"${post}>`;
        }
        return match;
      },
    );
  }

  function resolveYouTubeEmbeds(html: string): string {
    return html.replace(
      /<iframe\s+([^>]+?)>\s*<\/iframe>/gi,
      (match, attrs) => {
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) return match;
        const src = srcMatch[1];

        const isYouTube = /youtube(?:-nocookie)?\.com|youtu\.be/i.test(src);
        if (!isYouTube) return match;

        const ytMatch = src.match(
          /(?:youtube(?:-nocookie)?\.com\/(?:embed|v)\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i,
        );
        const videoId = ytMatch ? ytMatch[1] : null;

        const widthMatch = attrs.match(/width=["']([^"']+)["']/i);
        const titleMatch = attrs.match(/title=["']([^"']+)["']/i);

        const width = widthMatch ? widthMatch[1] : "560";
        const title = titleMatch ? titleMatch[1] : "YouTube Video";

        const thumbnailUrl = videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : "";
        const videoUrl = videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : src;

        const thumbnailStyle = videoId
          ? `background-image: url('${thumbnailUrl}')`
          : `background: linear-gradient(135deg, #1a1a1a 0%, #2e080b 100%);`;

        const fallbackContent = videoId
          ? ""
          : `<div class="yt-fallback-logo">
            <svg viewBox="0 0 24 24" fill="#ff0000" width="80" height="80" style="filter: drop-shadow(0 4px 16px rgba(255,0,0,0.45));">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
           </div>`;

        return `<a href="${videoUrl}" class="yt-card-link" title="${title}">
  <div class="yt-card" style="max-width: ${width}px;">
    <div class="yt-card-thumbnail" style="${thumbnailStyle}">
      ${fallbackContent}
      <div class="yt-card-overlay">
        ${
          videoId
            ? `
        <div class="yt-card-play-btn">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>`
            : ""
        }
        <div class="yt-card-info">
          <div class="yt-card-title">${title}</div>
          <div class="yt-card-subtitle">YouTube • Click to play in browser</div>
        </div>
      </div>
    </div>
  </div>
</a>`;
      },
    );
  }

  function updatePanel(
    doc: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    initial: boolean = false,
  ) {
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
      rendered = resolveYouTubeEmbeds(rendered);
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
    const sourceEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === docUriString,
    );
    const initialVisibleLine = sourceEditor?.visibleRanges[0]?.start.line || 0;

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
      },
    );

    updatePanel(doc, panel, true);

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "webviewReady":
            panel.webview.postMessage({
              command: "scrollToLine",
              line: initialVisibleLine,
            });
            break;
          case "openExternal":
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
          case "openRelative":
            let filePath = message.url;
            const hashIdx = filePath.indexOf("#");
            if (hashIdx !== -1) filePath = filePath.substring(0, hashIdx);
            const decodedPath = decodeURIComponent(filePath);
            const absolutePath = path.isAbsolute(decodedPath)
              ? decodedPath
              : path.resolve(docDir, decodedPath);
            if (fs.existsSync(absolutePath)) {
              vscode.workspace
                .openTextDocument(vscode.Uri.file(absolutePath))
                .then((doc) => {
                  vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
                });
            }
            break;
          case "previewScroll":
            if (typeof message.line === "number") {
              hostScrollingPanels.add(panel);
              const editor = vscode.window.visibleTextEditors.find(
                (ed) => ed.document.uri.toString() === docUriString,
              );
              if (editor) {
                const targetLine = Math.max(0, message.line);
                const targetRange = new vscode.Range(
                  targetLine,
                  0,
                  targetLine,
                  0,
                );
                editor.revealRange(
                  targetRange,
                  vscode.TextEditorRevealType.AtTop,
                );
              }
              setTimeout(() => {
                hostScrollingPanels.delete(panel);
              }, 300);
            }
            break;
          case "exportPdfHtml":
            let finalHtml = message.html;

            // Revert Webview sandbox URIs back to native file:/// absolute filesystem paths
            // so headless Google Chrome has direct read authorization.
            for (const [key, webviewUri] of imageCache.entries()) {
              const absolutePath = key.split("|")[1];
              const fileUri = vscode.Uri.file(absolutePath).toString();
              finalHtml = finalHtml.replaceAll(webviewUri, fileUri);
            }

            // Inject the pdf-exporting class directly into the body tag of the printed file
            // to keep the active Webview themed (no visual dark/light flash on screen!)
            finalHtml = finalHtml.replace(
              /<body([^>]*?)class="([^"]*?)"/i,
              '<body$1class="pdf-exporting $2"',
            );
            if (!/<body[^>]*?class=/i.test(finalHtml)) {
              finalHtml = finalHtml.replace(
                /<body([^>]*?)>/i,
                '<body$1 class="pdf-exporting">',
              );
            }

            // Force highlight-light to be enabled and highlight-dark to be disabled for print contrast
            finalHtml = finalHtml.replace(
              /id="highlight-light"([^>]*?)disabled/gi,
              'id="highlight-light"',
            );
            if (!/id="highlight-dark"[^>]*?disabled/gi.test(finalHtml)) {
              finalHtml = finalHtml.replace(
                'id="highlight-dark"',
                'id="highlight-dark" disabled',
              );
            }

            const tempHtmlPath = path.join(
              docDir,
              `temp_preview_${Date.now()}.html`,
            );
            try {
              fs.writeFileSync(tempHtmlPath, finalHtml, "utf8");
            } catch (e: any) {
              vscode.window.showErrorMessage(
                `Failed to prepare export: ${e.message}`,
              );
              break;
            }

            const chromeExecutable = findChromePath();

            const defaultName =
              path.basename(uri.fsPath, path.extname(uri.fsPath)) + ".pdf";
            const saveOptions: vscode.SaveDialogOptions = {
              defaultUri: vscode.Uri.file(path.join(docDir, defaultName)),
              filters: { "PDF Files": ["pdf"] },
              title: "Export to PDF",
            };

            vscode.window.showSaveDialog(saveOptions).then((fileUri) => {
              if (fileUri) {
                const chromeCmd = `"${chromeExecutable}" --headless --disable-gpu --no-sandbox --no-pdf-header-footer --print-to-pdf="${fileUri.fsPath}" "${tempHtmlPath}"`;

                cp.exec(chromeCmd, (error, stdout, stderr) => {
                  // Instantly purge temporary files
                  try {
                    if (fs.existsSync(tempHtmlPath)) {
                      fs.unlinkSync(tempHtmlPath);
                    }
                  } catch (e) {}

                  // Notify the webview that export is complete
                  panel.webview.postMessage({ command: "exportComplete" });

                  if (error) {
                    vscode.window.showErrorMessage(
                      `Failed to export PDF: ${stderr || error.message}`,
                    );
                  } else {
                    vscode.window.showInformationMessage(
                      `PDF successfully exported to: ${path.basename(fileUri.fsPath)}`,
                    );
                  }
                });
              } else {
                // User dismissed saving; wipe temporary file
                try {
                  if (fs.existsSync(tempHtmlPath)) {
                    fs.unlinkSync(tempHtmlPath);
                  }
                } catch (e) {}
                // Notify the webview that export is complete
                panel.webview.postMessage({ command: "exportComplete" });
              }
            });
            break;
        }
      },
      undefined,
      context.subscriptions,
    );

    panelMap.set(docUriString, panel);
    panel.onDidDispose(
      () => {
        panelMap.delete(docUriString);
        htmlCache.delete(docUriString);
      },
      null,
      context.subscriptions,
    );
  }

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
    },
  );

  // Track which panels are currently being scrolled by the host
  const hostScrollingPanels: Set<vscode.WebviewPanel> = new Set();

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
    },
  );

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
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
  const hostScrollThrottleMs = 30; // Buttere-smooth 33fps sync limit

  function syncPreviewScroll(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== "markdown") {
      return;
    }
    const uriStr = editor.document.uri.toString();
    if (!panelMap.has(uriStr)) {
      return;
    }
    const panel = panelMap.get(uriStr)!;

    // Skip if the panel is currently being scrolled by the host
    if (hostScrollingPanels.has(panel)) {
      return;
    }

    const now = Date.now();
    if (now - lastSyncTime >= hostScrollThrottleMs) {
      lastSyncTime = now;
      const visibleLine = editor.visibleRanges[0]?.start.line || 0;
      panel.webview.postMessage({ command: "scrollToLine", line: visibleLine });
    } else {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(() => {
        lastSyncTime = Date.now();
        const visibleLine = editor.visibleRanges[0]?.start.line || 0;
        panel.webview.postMessage({
          command: "scrollToLine",
          line: visibleLine,
        });
      }, hostScrollThrottleMs);
    }
  }

  // Listen for editor changes to show/hide status bar item
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      updateStatusBarItem();
      syncPreviewScroll(editor);
    },
    null,
    context.subscriptions,
  );

  vscode.window.onDidChangeTextEditorVisibleRanges(
    (e) => {
      syncPreviewScroll(e.textEditor);
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidOpenTextDocument(
    updateStatusBarItem,
    null,
    context.subscriptions,
  );

  context.subscriptions.push(toggleCommand, viewPreviewCommand);

  // Live updates via postMessage (Debounced for high performance)
  const updateTimeoutMap = new Map<string, NodeJS.Timeout>();
  vscode.workspace.onDidChangeTextDocument(
    (e) => {
      if (e.document.languageId === "markdown") {
        const uriStr = e.document.uri.toString();
        if (panelMap.has(uriStr)) {
          if (updateTimeoutMap.has(uriStr)) {
            clearTimeout(updateTimeoutMap.get(uriStr)!);
          }
          const timeout = setTimeout(() => {
            updatePanel(e.document, panelMap.get(uriStr)!, false);
            updateTimeoutMap.delete(uriStr);
          }, 150); // 150ms debounce for typing performance
          updateTimeoutMap.set(uriStr, timeout);
        }
      }
    },
    null,
    context.subscriptions,
  );
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
        /* Highlight.js custom overrides */
        .hljs { background: transparent !important; padding: 0 !important; }

        /* YouTube Embed Cards */
        .yt-card-link {
            display: block;
            margin: 24px auto;
            text-decoration: none !important;
            color: inherit !important;
            max-width: 100%;
        }
        .yt-card {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 9;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid var(--vscode-panel-border);
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease;
        }
        .yt-card-link:hover .yt-card {
            transform: translateY(-4px);
            box-shadow: 0 12px 28px rgba(0,0,0,0.22);
            border-color: var(--vscode-focusBorder);
        }
        .yt-card-thumbnail {
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            position: relative;
        }
        .yt-card-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 100%);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 20px;
            box-sizing: border-box;
        }
        .yt-card-play-btn {
            align-self: center;
            margin-top: auto;
            margin-bottom: auto;
            width: 68px;
            height: 48px;
            background-color: rgba(229, 9, 20, 0.95);
            color: #ffffff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            transition: background-color 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .yt-card-play-btn svg {
            width: 24px;
            height: 24px;
        }
        .yt-card-link:hover .yt-card-play-btn {
            background-color: #ff0000;
            transform: scale(1.12);
        }
        .yt-card-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: left;
        }
        .yt-card-title {
            color: #ffffff;
            font-size: 1.1em;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        .yt-card-subtitle {
            color: rgba(255, 255, 255, 0.75);
            font-size: 0.85em;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        .yt-fallback-logo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .yt-card-link:hover .yt-fallback-logo {
            transform: translate(-50%, -50%) scale(1.08);
        }

        /* PDF Export Floating Button */
        .pdf-export-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            z-index: 1000;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s ease, opacity 0.2s ease;
        }
        .pdf-export-btn:hover {
            transform: scale(1.08);
            background-color: var(--vscode-button-hoverBackground);
        }
        .pdf-export-btn svg {
            width: 18px;
            height: 18px;
            transition: opacity 0.2s ease;
        }

        /* Sleek progress indicator spinner */
        .pdf-export-btn.loading svg {
            opacity: 0 !important;
            pointer-events: none;
        }
        .pdf-export-btn.loading::after {
            content: "";
            position: absolute;
            width: 18px;
            height: 18px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-right-color: currentColor;
            border-radius: 50%;
            animation: spin-loader 0.75s linear infinite;
        }
        @keyframes spin-loader {
            to { transform: rotate(360deg); }
        }

        /* Publication-Grade PDF Print Style overrides */
        body.pdf-exporting {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
            padding: 24px 32px !important;
            max-width: 800px !important;
            margin: 0 auto !important;
        }
        body.pdf-exporting h1, 
        body.pdf-exporting h2, 
        body.pdf-exporting h3, 
        body.pdf-exporting h4, 
        body.pdf-exporting h5, 
        body.pdf-exporting h6 {
            color: #111111 !important;
            border-bottom-color: #e5e5e5 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        body.pdf-exporting a {
            color: #0066cc !important;
        }
        body.pdf-exporting pre {
            background-color: #f7f7f7 !important;
            border: 1px solid #e1e1e1 !important;
            color: #24292e !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        body.pdf-exporting code {
            background-color: #f7f7f7 !important;
            color: #24292e !important;
        }
        body.pdf-exporting blockquote {
            background-color: #fcfcfc !important;
            border-left-color: #d1d1d1 !important;
            color: #586069 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        body.pdf-exporting img {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-height: 450px !important;
            object-fit: contain !important;
        }
        body.pdf-exporting table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        body.pdf-exporting tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        body.pdf-exporting th,
        body.pdf-exporting td {
            border-color: #e1e1e1 !important;
            color: #1a1a1a !important;
        }
        body.pdf-exporting th {
            background-color: #f7f7f7 !important;
        }
        body.pdf-exporting tr:nth-child(even) {
            background-color: #fafafa !important;
        }
        body.pdf-exporting .mermaid {
            background-color: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-width: 100% !important;
            overflow: visible !important;
        }
        body.pdf-exporting .mermaid svg {
            max-width: 100% !important;
            height: auto !important;
        }
        body.pdf-exporting .mermaid text {
            fill: #1a1a1a !important;
        }
        body.pdf-exporting .yt-card {
            border-color: #e5e5e5 !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        body.pdf-exporting .yt-card-subtitle {
            color: rgba(255, 255, 255, 0.8) !important;
        }
        body.pdf-exporting .minimap-panel,
        body.pdf-exporting .minimap-toggle-handle {
            display: none !important;
        }
        body.pdf-exporting {
            padding-right: 0 !important;
        }

        /* VS Code style Minimap / Outline Panel */
        body {
            transition: padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        body.minimap-open {
            padding-right: 292px; /* 260px panel width + 32px padding gap */
        }
        @media (max-width: 1024px) {
            body.minimap-open {
                padding-right: 32px; /* overlay on small screens instead of reflow */
            }
        }

        .minimap-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 260px;
            z-index: 1000;
            background: var(--vscode-sideBar-background, rgba(30, 30, 30, 0.75));
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-left: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
            box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
            transform: translateX(0);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
        }
        .minimap-panel.collapsed {
            transform: translateX(100%);
        }

        /* Sleek toggle handle pinned to the right edge when collapsed */
        .minimap-toggle-handle {
            position: fixed;
            top: 24px;
            right: 0;
            width: 32px;
            height: 40px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
            border-right: none;
            border-radius: 6px 0 0 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 999;
            box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
        }
        .minimap-toggle-handle.visible {
            transform: translateX(0);
        }
        .minimap-toggle-handle:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .minimap-toggle-handle svg {
            width: 16px;
            height: 16px;
        }

        /* Header Buttons */
        .minimap-action-btn {
            background: none;
            border: none;
            color: var(--vscode-editor-foreground);
            opacity: 0.6;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
            border-radius: 4px;
            width: 28px;
            height: 28px;
            position: relative;
            transition: all 0.2s ease;
        }
        .minimap-action-btn:hover {
            opacity: 1;
            background: rgba(128, 128, 128, 0.15);
        }
        .minimap-action-btn svg {
            width: 18px;
            height: 18px;
        }

        /* PDF Export spinner inside minimap */
        .minimap-action-btn.loading svg {
            opacity: 0 !important;
            pointer-events: none;
        }
        .minimap-action-btn.loading::after {
            content: "";
            position: absolute;
            width: 14px;
            height: 14px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-right-color: currentColor;
            border-radius: 50%;
            animation: spin-loader 0.75s linear infinite;
        }

        /* TOC inside minimap */
        .minimap-toc-item {
            display: block;
            padding: 6px 10px;
            color: var(--vscode-editor-foreground);
            opacity: 0.6;
            font-size: 11.5px;
            border-radius: 4px;
            transition: all 0.15s ease;
            margin-bottom: 2px;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-left: 2px solid transparent;
            text-decoration: none !important;
        }
        .minimap-toc-item:hover {
            opacity: 0.95;
            background: rgba(128, 128, 128, 0.08);
        }
        .minimap-toc-item.active {
            opacity: 1;
            font-weight: 600;
            color: var(--vscode-textLink-foreground, #007acc);
            background: rgba(128, 128, 128, 0.05);
            border-left-color: var(--vscode-textLink-foreground, #007acc);
        }
        .toc-h1 { padding-left: 8px; }
        .toc-h2 { padding-left: 18px; }
        .toc-h3 { padding-left: 28px; }
        .toc-h4 { padding-left: 38px; }
    </style>
    <!-- KaTeX CSS & Client JS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
    <!-- Highlight.js Themes (Light/Dark) -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css" id="highlight-light">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css" id="highlight-dark">
    <!-- Morphdom for highly optimized DOM diffing -->
    <script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.0/dist/morphdom-umd.min.js"></script>
</head>
<body>
    <div id="content">${body}</div>

    <!-- Minimap Toggle Handle (only visible when collapsed) -->
    <div class="minimap-toggle-handle" id="minimapToggleHandle" title="Show Outline">
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
    </div>

    <!-- Minimap Panel -->
    <div class="minimap-panel" id="minimapPanel">
        <div class="minimap-header" style="height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));">
            <span style="font-weight: 600; font-size: 10.5px; letter-spacing: 1px; color: var(--vscode-sideBarTitle-foreground, #808080); text-transform: uppercase;">Outline</span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="minimap-action-btn" id="exportPdfBtn" title="Export to PDF">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
                    </svg>
                </button>
                <button class="minimap-action-btn" id="collapseMinimapBtn" title="Collapse Outline">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div id="tocList" style="flex: 1; overflow-y: auto; padding: 12px 14px;"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        const vscodeApi = acquireVsCodeApi();
        let previewScrollTimeout = null;
        let isHostScrolling = false;
        let lastScrollTime = 0;
        let hostScrollResetTimeout = null;

        function handlePreviewScroll() {
            if (isHostScrolling) {
                return;
            }

            const elements = Array.from(document.querySelectorAll('[data-line]'));
            if (elements.length === 0) return;

            const viewportTop = 80;
            let closestElement = null;
            let closestDistance = Infinity;

            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                const distance = Math.abs(rect.top - viewportTop);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = el;
                }
            }

            if (!closestElement) return;
            const line = parseInt(closestElement.getAttribute('data-line'), 10);
            if (!Number.isFinite(line)) return;

            vscodeApi.postMessage({ command: 'previewScroll', line });
        }

        // Theme switching logic
        const lightTheme = document.getElementById('highlight-light');
        const darkTheme = document.getElementById('highlight-dark');

        function updateTheme() {
            const isDark = document.body.classList.contains('vscode-dark') || 
                           document.body.classList.contains('vscode-high-contrast');
            if (isDark) {
                if (lightTheme) lightTheme.disabled = true;
                if (darkTheme) darkTheme.disabled = false;
            } else {
                if (lightTheme) lightTheme.disabled = false;
                if (darkTheme) darkTheme.disabled = true;
            }
        }

        // Watch for body class changes
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // Run once initially
        updateTheme();

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

        // Dynamic Table of Contents (TOC) builder
        function buildTableOfContents() {
            const tocList = document.getElementById('tocList');
            if (!tocList) return;

            const headings = Array.from(document.querySelectorAll('#content h1, #content h2, #content h3, #content h4'));
            if (headings.length === 0) {
                tocList.innerHTML = '<div style="opacity: 0.5; font-style: italic; text-align: center; padding: 20px; font-size: 11px; color: var(--vscode-editor-foreground);">No headings found</div>';
                return;
            }

            tocList.innerHTML = headings.map(function(heading) {
                var id = heading.getAttribute('id');
                if (!id) {
                    var text = heading.textContent || '';
                    id = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
                    heading.setAttribute('id', id);
                }
                var text = heading.textContent || '';
                var level = heading.tagName.toLowerCase(); // h1, h2, h3, h4
                return '<a href="#' + id + '" class="minimap-toc-item toc-' + level + '" data-id="' + id + '">' + text + '</a>';
            }).join('');

            tocList.querySelectorAll('.minimap-toc-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = item.getAttribute('data-id');
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });

            updateScrollSpy();
        }

        // Active Scroll Spy logic
        function updateScrollSpy() {
            const headings = Array.from(document.querySelectorAll('#content h1, #content h2, #content h3, #content h4'));
            const tocItems = Array.from(document.querySelectorAll('.minimap-toc-item'));
            if (headings.length === 0 || tocItems.length === 0) return;

            let activeId = null;
            const scrollOffset = 120; // Trigger slightly before heading hits top

            for (const heading of headings) {
                const rect = heading.getBoundingClientRect();
                if (rect.top <= scrollOffset) {
                    activeId = heading.getAttribute('id');
                } else {
                    break;
                }
            }

            if (!activeId) {
                activeId = headings[0].getAttribute('id');
            }

            tocItems.forEach(item => {
                if (item.getAttribute('data-id') === activeId) {
                    item.classList.add('active');
                    item.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        }

        // Minimap Panel open/collapse control
        const minimapPanel = document.getElementById('minimapPanel');
        const minimapToggleHandle = document.getElementById('minimapToggleHandle');

        function setMinimapState(collapsed) {
            if (collapsed) {
                minimapPanel.classList.add('collapsed');
                minimapToggleHandle.classList.add('visible');
                document.body.classList.remove('minimap-open');
                localStorage.setItem('minimap-collapsed', 'true');
            } else {
                minimapPanel.classList.remove('collapsed');
                minimapToggleHandle.classList.remove('visible');
                document.body.classList.add('minimap-open');
                localStorage.setItem('minimap-collapsed', 'false');
            }
        }

        // Initialize from localStorage (default to open)
        const isCollapsed = localStorage.getItem('minimap-collapsed') === 'true';
        setMinimapState(isCollapsed);

        document.getElementById('collapseMinimapBtn').addEventListener('click', () => setMinimapState(true));
        minimapToggleHandle.addEventListener('click', () => setMinimapState(false));
        window.addEventListener('scroll', () => {
            updateScrollSpy();
            
            if (isHostScrolling) {
                if (hostScrollResetTimeout) {
                    clearTimeout(hostScrollResetTimeout);
                }
                hostScrollResetTimeout = setTimeout(() => {
                    isHostScrolling = false;
                }, 100);
                return;
            }

            const now = Date.now();
            if (now - lastScrollTime >= 50) {
                handlePreviewScroll();
                lastScrollTime = now;
            } else {
                if (previewScrollTimeout) {
                    clearTimeout(previewScrollTimeout);
                }
                previewScrollTimeout = window.setTimeout(handlePreviewScroll, 100);
            }
        });

        // Listen for live incremental updates or export complete signals (Registered first!)
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                if (typeof morphdom !== 'undefined') {
                    const wrapper = document.createElement('div');
                    wrapper.id = 'content';
                    wrapper.innerHTML = message.body;
                    morphdom(document.getElementById('content'), wrapper);
                } else {
                    document.getElementById('content').innerHTML = message.body;
                }
                renderMathAndMermaid();
                buildTableOfContents();
            } else if (message.command === 'exportComplete') {
                const btn = document.getElementById('exportPdfBtn');
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            } else if (message.command === 'scrollToLine') {
                const targetLine = message.line;
                
                // Find all elements with data-line attributes
                const elements = Array.from(document.querySelectorAll('[data-line]'));
                if (elements.length === 0) return;
                
                // Find the closest element that has a data-line equal to or just before the target line
                let closestElement = null;
                let minDiff = Infinity;
                
                for (const el of elements) {
                    const line = parseInt(el.getAttribute('data-line'), 10);
                    const diff = targetLine - line;
                    
                    // We prefer elements that start exactly at or before the target line
                    if (diff >= 0 && diff < minDiff) {
                        minDiff = diff;
                        closestElement = el;
                    }
                }
                
                // If no element starts before, just take the first element
                if (!closestElement && elements.length > 0) {
                    closestElement = elements[0];
                }
                
                if (closestElement) {
                    isHostScrolling = true;
                    if (hostScrollResetTimeout) {
                        clearTimeout(hostScrollResetTimeout);
                    }
                    closestElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Immediately sync TOC active item with editor's scroll position
                    setTimeout(updateScrollSpy, 100);
                }
            }
        });

        // Initial render
        renderMathAndMermaid();
        buildTableOfContents();

        // Signal host that webview is loaded and ready
        vscodeApi.postMessage({ command: 'webviewReady' });

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
                vscodeApi.postMessage({ command: 'openExternal', url: href });
                return;
            }

            if (!href.startsWith('mailto:')) {
                e.preventDefault();
                vscodeApi.postMessage({ command: 'openRelative', url: href });
            }
        });

        // PDF Export click listener
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            const btn = document.getElementById('exportPdfBtn');
            btn.classList.add('loading');
            btn.disabled = true;

            // Instantly capture the fully rendered DOM
            const htmlContent = document.documentElement.outerHTML;
            
            vscodeApi.postMessage({
                command: 'exportPdfHtml',
                html: htmlContent
            });
        });
    </script>
</body>
</html>`;
}

function findChromePath(): string {
  // 1. Check user configuration first
  const userConfigPath = vscode.workspace
    .getConfiguration("mdViewer")
    .get<string>("chromePath");
  if (userConfigPath && fs.existsSync(userConfigPath)) {
    return userConfigPath;
  }

  const platform = process.platform;

  if (platform === "win32") {
    const suffix = "\\Google\\Chrome\\Application\\chrome.exe";
    const prefixes = [
      process.env.PROGRAMFILES || "C:\\Program Files",
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
      process.env.LOCALAPPDATA || "C:\\Users\\Default\\AppData\\Local",
    ];
    for (const prefix of prefixes) {
      const chromePath = path.join(prefix, suffix);
      if (fs.existsSync(chromePath)) return chromePath;
    }
    // Fallback to Edge on Windows
    const edgePath = path.join(
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
      "Microsoft\\Edge\\Application\\msedge.exe",
    );
    if (fs.existsSync(edgePath)) return edgePath;
  } else if (platform === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    // Search standard executable commands in PATH
    const executables = [
      "google-chrome",
      "google-chrome-stable",
      "chromium-browser",
      "chromium",
      "microsoft-edge",
    ];
    for (const exec of executables) {
      try {
        const checkCmd = `which ${exec}`;
        const output = cp
          .execSync(checkCmd, { encoding: "utf8" })
          .toString()
          .trim();
        if (output && fs.existsSync(output)) {
          return output;
        }
      } catch (e) {}
    }
  }

  // Final fallback (just executable name, hoping it's in the PATH)
  return platform === "win32" ? "chrome.exe" : "google-chrome";
}

export function deactivate() {}
