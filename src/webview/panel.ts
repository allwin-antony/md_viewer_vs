import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { MarkdownRenderer } from "../markdown/renderer";
import { getWebviewContent } from "./template";
import { findChromePath, exportToPdf } from "../utils/pdf";
import { exportStandaloneHtml } from "../utils/html";

export class MarkdownPreviewPanel {
  public static readonly viewType = "mdViewer";
  private readonly panel: vscode.WebviewPanel;
  private readonly doc: vscode.TextDocument;
  private readonly context: vscode.ExtensionContext;
  private readonly renderer: MarkdownRenderer;
  private readonly imageCache: Map<string, string>;
  private readonly htmlCache: Map<string, { hash: string; html: string }>;
  private readonly hostScrollingPanels: Set<vscode.WebviewPanel>;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(
    panel: vscode.WebviewPanel,
    doc: vscode.TextDocument,
    context: vscode.ExtensionContext,
    renderer: MarkdownRenderer,
    hostScrollingPanels: Set<vscode.WebviewPanel>
  ) {
    this.panel = panel;
    this.doc = doc;
    this.context = context;
    this.renderer = renderer;
    this.hostScrollingPanels = hostScrollingPanels;
    this.imageCache = new Map();
    this.htmlCache = new Map();

    // Listen for Webview lifecycle
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg), null, this.context.subscriptions);

    // Initial render
    this.update(true);
  }

  public update(initial: boolean = false) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    const text = this.doc.getText();
    const hash = crypto.createHash("md5").update(text).digest("hex");
    const uriStr = this.doc.uri.toString();

    let htmlContent = "";
    if (this.htmlCache.has(uriStr) && this.htmlCache.get(uriStr)!.hash === hash) {
      htmlContent = this.htmlCache.get(uriStr)!.html;
    } else {
      const docDir = path.dirname(this.doc.uri.fsPath);
      htmlContent = this.renderer.render(text, docDir, this.panel.webview, this.imageCache);
      this.htmlCache.set(uriStr, { hash, html: htmlContent });
    }

    if (initial) {
      this.panel.webview.html = getWebviewContent(htmlContent, this.panel.webview, this.context);
    } else {
      this.panel.webview.postMessage({ command: "update", body: htmlContent });
    }
  }

  public postMessage(message: any) {
    this.panel.webview.postMessage(message);
  }

  public get webviewPanel(): vscode.WebviewPanel {
    return this.panel;
  }

  public reveal(column: vscode.ViewColumn) {
    this.panel.reveal(column);
  }

  public dispose() {
    this.panel.dispose();
  }

  public onDidDispose(fn: () => void) {
    this.panel.onDidDispose(fn, null, this.context.subscriptions);
  }

  private handleMessage(message: any) {
    const docDir = path.dirname(this.doc.uri.fsPath);
    const docUriString = this.doc.uri.toString();

    switch (message.command) {
      case "webviewReady":
        const sourceEditor = vscode.window.visibleTextEditors.find(
          (editor) => editor.document.uri.toString() === docUriString
        );
        const initialVisibleLine = sourceEditor?.visibleRanges[0]?.start.line || 0;
        this.panel.webview.postMessage({
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
          vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath)).then((doc) => {
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
          });
        }
        break;

      case "previewScroll":
        if (typeof message.line === "number") {
          this.hostScrollingPanels.add(this.panel);
          const editor = vscode.window.visibleTextEditors.find(
            (ed) => ed.document.uri.toString() === docUriString
          );
          if (editor) {
            const targetLine = Math.max(0, message.line);
            const targetRange = new vscode.Range(targetLine, 0, targetLine, 0);
            editor.revealRange(targetRange, vscode.TextEditorRevealType.AtTop);
          }
          setTimeout(() => {
            this.hostScrollingPanels.delete(this.panel);
          }, 300);
        }
        break;

      case "toggleCheckbox":
        if (typeof message.line === "number") {
          const lineNum = message.line;
          const checked = message.checked;
          const editor = vscode.window.visibleTextEditors.find(
            (ed) => ed.document.uri.toString() === docUriString
          );
          if (editor) {
            const lineText = editor.document.lineAt(lineNum).text;
            const taskMatch = lineText.match(/^(\s*[-*+]\s*\[)([^\]]*)(\].*)/i);
            if (taskMatch) {
              const newStatus = checked ? "x" : " ";
              const newLineText = lineText.replace(/^(\s*[-*+]\s*\[)([^\]]*)(\].*)/i, `$1${newStatus}$3`);
              editor.edit((editBuilder) => {
                const range = new vscode.Range(lineNum, 0, lineNum, lineText.length);
                editBuilder.replace(range, newLineText);
              });
            }
          }
        }
        break;

      case "exportPdfHtml":
        this.handlePdfExport(message.html);
        break;

      case "exportStandaloneHtml":
        this.handleHtmlExport(message.html);
        break;
    }
  }

  private async handlePdfExport(rawHtml: string) {
    let finalHtml = rawHtml;
    const docDir = path.dirname(this.doc.uri.fsPath);

    // Revert Webview sandbox URIs back to native file:/// absolute filesystem paths
    for (const [key, webviewUri] of this.imageCache.entries()) {
      const absolutePath = key.split("|")[1];
      const fileUri = vscode.Uri.file(absolutePath).toString();
      finalHtml = finalHtml.split(webviewUri).join(fileUri);
    }

    // Inject class directly into body tag
    finalHtml = finalHtml.replace(
      /<body([^>]*?)class="([^"]*?)"/i,
      '<body$1class="pdf-exporting $2"'
    );
    if (!/<body[^>]*?class=/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(
        /<body([^>]*?)>/i,
        '<body$1 class="pdf-exporting">'
      );
    }

    // Force highlight-light print contrast
    finalHtml = finalHtml.replace(
      /id="highlight-light"([^>]*?)disabled/gi,
      'id="highlight-light"'
    );
    if (!/id="highlight-dark"[^>]*?disabled/gi.test(finalHtml)) {
      finalHtml = finalHtml.replace(
        'id="highlight-dark"',
        'id="highlight-dark" disabled'
      );
    }

    const tempHtmlPath = path.join(docDir, `temp_preview_${Date.now()}.html`);
    try {
      fs.writeFileSync(tempHtmlPath, finalHtml, "utf8");
    } catch (e: any) {
      vscode.window.showErrorMessage(`Failed to prepare export: ${e.message}`);
      this.panel.webview.postMessage({ command: "exportComplete" });
      return;
    }

    const chromeExecutable = findChromePath();
    const defaultName = path.basename(this.doc.uri.fsPath, path.extname(this.doc.uri.fsPath)) + ".pdf";
    const saveOptions: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.file(path.join(docDir, defaultName)),
      filters: { "PDF Files": ["pdf"] },
      title: "Export to PDF",
    };

    const fileUri = await vscode.window.showSaveDialog(saveOptions);
    if (fileUri) {
      try {
        await exportToPdf(chromeExecutable, tempHtmlPath, fileUri.fsPath);
        vscode.window.showInformationMessage(`PDF successfully exported to: ${path.basename(fileUri.fsPath)}`);
      } catch (err: any) {
        const isNotFoundError = err.message.includes("ENOENT") || 
                              err.message.includes("not found") || 
                              err.message.includes("is not recognized");
        
        let errorMsg = `Failed to export PDF: ${err.message}`;
        if (isNotFoundError) {
          errorMsg = `Failed to export PDF: Google Chrome or Chromium executable could not be found. If it is installed via Snap/Flatpak or a custom location, please specify its path in the settings.`;
        }

        vscode.window.showErrorMessage(errorMsg, "Configure Chrome Path").then((selection) => {
          if (selection === "Configure Chrome Path") {
            vscode.commands.executeCommand("workbench.action.openSettings", "mdViewer.chromePath");
          }
        });
      } finally {
        this.cleanupTempFile(tempHtmlPath);
        this.panel.webview.postMessage({ command: "exportComplete" });
      }
    } else {
      this.cleanupTempFile(tempHtmlPath);
      this.panel.webview.postMessage({ command: "exportComplete" });
    }
  }

  private async handleHtmlExport(rawHtml: string) {
    try {
      await exportStandaloneHtml(
        rawHtml,
        this.doc.uri.fsPath,
        this.imageCache,
        this.context.extensionPath
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to export HTML: ${err.message}`);
    } finally {
      this.panel.webview.postMessage({ command: "exportComplete" });
    }
  }

  private cleanupTempFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}
  }
}
