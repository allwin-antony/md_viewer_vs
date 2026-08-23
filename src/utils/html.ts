import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getMimeType, resolveImagePath } from "../markdown/renderer";

/**
 * Inlines local image paths in the rendered HTML as Base64 Data URIs.
 * Supports relative paths, Windows absolute paths, Linux absolute paths, and file:/// URIs.
 * This ensures the exported HTML/PDF is fully portable and self-contained.
 */
export function inlineLocalImages(
  html: string,
  imageCache: Map<string, string>,
  docDir?: string
): string {
  let finalHtml = html;

  // 1. Inline all cached webview URIs
  for (const [key, value] of imageCache.entries()) {
    if (key.startsWith("http") || key.startsWith("vscode-") || key.startsWith("file+")) {
      const absolutePath = value;
      if (absolutePath && fs.existsSync(absolutePath)) {
        try {
          const mimeType = getMimeType(absolutePath);
          const imageBuffer = fs.readFileSync(absolutePath);
          const base64Data = imageBuffer.toString("base64");
          const base64Uri = `data:${mimeType};base64,${base64Data}`;
          finalHtml = finalHtml.split(key).join(base64Uri);
        } catch (err) {
          console.error(`Failed to inline cached image: ${absolutePath}`, err);
        }
      }
    }
  }

  // 2. Scan and inline any remaining local <img> tags in the HTML
  if (docDir) {
    finalHtml = finalHtml.replace(
      /<img\s+([^>]*?)src=(["'])([^"']+)\2([^>]*?)>/gi,
      (match, pre, quote, src, post) => {
        if (/^(https?:|\/\/|data:)/i.test(src)) {
          return match;
        }
        const absolutePath = resolveImagePath(src, docDir);
        if (absolutePath && fs.existsSync(absolutePath)) {
          try {
            const mimeType = getMimeType(absolutePath);
            const imageBuffer = fs.readFileSync(absolutePath);
            const base64Data = imageBuffer.toString("base64");
            const base64Uri = `data:${mimeType};base64,${base64Data}`;
            return `<img ${pre}src="${base64Uri}"${post}>`;
          } catch (err) {
            return match;
          }
        }
        return match;
      }
    );
  }

  return finalHtml;
}

/**
 * Generates self-contained standalone HTML with all assets, KaTeX math, Mermaid diagrams,
 * Highlight.js themes, and Base64 images fully embedded.
 */
export function generateExportHtml(
  bodyHtml: string,
  docDir: string,
  extensionPath: string,
  imageCache: Map<string, string>,
  forPdf: boolean = false
): string {
  let katexCss = "";
  let highlightCss = "";
  let katexJs = "";
  let autoRenderJs = "";
  let mermaidJs = "";

  try {
    katexCss = fs.readFileSync(path.join(extensionPath, "resources", "katex", "katex.min.css"), "utf8");
    highlightCss = fs.readFileSync(path.join(extensionPath, "resources", "highlight", "github.min.css"), "utf8");
    katexJs = fs.readFileSync(path.join(extensionPath, "resources", "katex", "katex.min.js"), "utf8");
    autoRenderJs = fs.readFileSync(path.join(extensionPath, "resources", "katex", "auto-render.min.js"), "utf8");
    mermaidJs = fs.readFileSync(path.join(extensionPath, "resources", "mermaid", "mermaid.min.js"), "utf8");
  } catch (e) {}

  const config = vscode.workspace.getConfiguration("mdViewer.preview");
  const fontFamily = config.get<string>("fontFamily") || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const fontSize = config.get<string>("fontSize") || "14px";
  const lineHeight = config.get<string>("lineHeight") || "1.7";

  const pdfConfig = vscode.workspace.getConfiguration("mdViewer.pdf");
  const pageSize = pdfConfig.get<string>("pageSize") || "A4";
  const orientation = pdfConfig.get<string>("orientation") || "portrait";
  const margins = pdfConfig.get<string>("margins") || "normal";

  let marginValue = "15mm";
  if (margins === "compact") marginValue = "8mm";
  else if (margins === "academic") marginValue = "25.4mm";
  else if (margins === "none") marginValue = "0mm";

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export</title>
  <style>
    ${katexCss}
    ${highlightCss}
    :root {
      --content-max-width: 960px;
      --preview-font-family: ${fontFamily};
      --preview-font-size: ${fontSize};
      --preview-line-height: ${lineHeight};
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--preview-font-family);
      font-size: var(--preview-font-size);
      line-height: var(--preview-line-height);
      color: #24292e;
      background-color: #ffffff;
      padding: 32px 40px;
      max-width: var(--content-max-width);
      margin: 0 auto;
      word-wrap: break-word;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
    code { font-family: 'Fira Code', 'Cascadia Code', monospace; background-color: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    pre code { padding: 0; background-color: transparent; }
    img { max-width: 100%; height: auto; border-radius: 4px; display: inline-block; }
    blockquote { border-left: 4px solid #dfe2e5; padding: 0 1em; color: #6a737d; margin: 0 0 16px 0; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; display: block; overflow-x: auto; }
    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    th { font-weight: 600; background-color: #f6f8fa; }
    tr:nth-child(2n) { background-color: #f6f8fa; }
    .task-list-item { list-style-type: none; margin-left: -1.5em; display: flex; align-items: center; gap: 8px; }
    .katex-display { margin: 1em 0; overflow-x: auto; text-align: center; }
    .mermaid { text-align: center; margin: 24px 0; }
    
    /* Alert Blocks */
    .alert-block { padding: 14px 18px; margin: 16px 0; border-left: 4px solid #0366d6; background-color: rgba(3, 102, 214, 0.08); border-radius: 0 6px 6px 0; }
    .alert-note { border-left-color: #0366d6; background-color: #f1f8ff; }
    .alert-tip { border-left-color: #28a745; background-color: #dcffe4; }
    .alert-important { border-left-color: #6f42c1; background-color: #f5f0ff; }
    .alert-warning { border-left-color: #f9826c; background-color: #fff5f2; }
    .alert-caution { border-left-color: #d73a49; background-color: #ffeef0; }

    ${forPdf ? `
    /* PDF Print Styles & Page Configuration */
    @page {
      size: ${pageSize} ${orientation};
      margin: ${marginValue};
    }
    body.pdf-exporting {
      padding: 0 !important;
      max-width: 100% !important;
      background: #ffffff !important;
      color: #1a1a1a !important;
    }
    body.pdf-exporting h1, body.pdf-exporting h2, body.pdf-exporting h3 { page-break-after: avoid; break-after: avoid; }
    body.pdf-exporting pre, body.pdf-exporting blockquote, body.pdf-exporting table, body.pdf-exporting .mermaid { page-break-inside: avoid; break-inside: avoid; }
    body.pdf-exporting img {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: 650px !important;
      object-fit: contain !important;
    }
    ` : ''}
  </style>
</head>
<body${forPdf ? ' class="pdf-exporting"' : ''}>
  <div id="content">${bodyHtml}</div>
  
  <script>${katexJs}</script>
  <script>${autoRenderJs}</script>
  <script>${mermaidJs}</script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
          ]
        });
      }
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        mermaid.run().then(function() {
          document.body.dataset.rendered = "true";
        }).catch(function() {
          document.body.dataset.rendered = "true";
        });
      } else {
        document.body.dataset.rendered = "true";
      }
    });
    // Fallback immediate execution
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(document.body, {
        delimiters: [
          {left: "$$", right: "$$", display: true},
          {left: "$", right: "$", display: false}
        ]
      });
    }
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
      } catch(_) {}
    }
  </script>
</body>
</html>`;

  // Inline all images as Base64 Data URIs
  html = inlineLocalImages(html, imageCache, docDir);
  return html;
}

/**
 * Formats and packages a fully styled, self-contained HTML file from active webview DOM.
 */
export async function exportStandaloneHtml(
  htmlContent: string,
  docPath: string,
  imageCache: Map<string, string>,
  extensionPath: string
): Promise<void> {
  const docDir = path.dirname(docPath);
  const defaultName = path.basename(docPath, path.extname(docPath)) + ".html";

  const saveOptions: vscode.SaveDialogOptions = {
    defaultUri: vscode.Uri.file(path.join(docDir, defaultName)),
    filters: { "HTML Files": ["html"] },
    title: "Export to Standalone HTML",
  };

  const fileUri = await vscode.window.showSaveDialog(saveOptions);
  if (!fileUri) {
    return; // Cancelled
  }

  // 1. Inline all local relative and absolute images as base64 data URIs
  let bundledHtml = inlineLocalImages(htmlContent, imageCache, docDir);

  // 2. Remove client-only elements (like the outline panel and toggle handles) wrapped in comment markers
  bundledHtml = bundledHtml.replace(/<!-- START_MINIMAP_PANEL -->[\s\S]*?<!-- END_MINIMAP_PANEL -->/gi, "");
  bundledHtml = bundledHtml.replace(/<!-- START_MINIMAP_TOGGLE -->[\s\S]*?<!-- END_MINIMAP_TOGGLE -->/gi, "");

  // 3. Force light styles and styling cleanup for clean browser rendering
  bundledHtml = bundledHtml.replace(
    /id="highlight-light"([^>]*?)disabled/gi,
    'id="highlight-light"'
  );
  if (!/id="highlight-dark"[^>]*?disabled/gi.test(bundledHtml)) {
    bundledHtml = bundledHtml.replace(
      'id="highlight-dark"',
      'id="highlight-dark" disabled'
    );
  }

  // Write compiled standalone file
  try {
    fs.writeFileSync(fileUri.fsPath, bundledHtml, "utf8");
    vscode.window.showInformationMessage(
      `HTML successfully exported to: ${path.basename(fileUri.fsPath)}`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to export HTML: ${err.message}`);
  }
}

/**
 * Programmatically exports a document to Standalone HTML.
 * If targetPath is provided, skips GUI save dialog.
 * Returns the output path string, or undefined if cancelled.
 */
export async function exportDocumentToHtml(
  doc: vscode.TextDocument,
  context: vscode.ExtensionContext,
  renderer: { renderHeadless: (text: string, docDir: string, cache: Map<string, string>) => string },
  targetPath?: string | vscode.Uri
): Promise<string | undefined> {
  const docDir = path.dirname(doc.uri.fsPath);
  const defaultName = path.basename(doc.uri.fsPath, path.extname(doc.uri.fsPath)) + ".html";

  let finalHtmlPath: string;
  if (targetPath) {
    finalHtmlPath = typeof targetPath === "string" ? targetPath : targetPath.fsPath;
  } else {
    const saveOptions: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.file(path.join(docDir, defaultName)),
      filters: { "HTML Files": ["html"] },
      title: "Export to Standalone HTML",
    };
    const fileUri = await vscode.window.showSaveDialog(saveOptions);
    if (!fileUri) return undefined;
    finalHtmlPath = fileUri.fsPath;
  }

  const imageCache = new Map<string, string>();
  const bodyHtml = renderer.renderHeadless(doc.getText(), docDir, imageCache);
  const fullHtml = generateExportHtml(bodyHtml, docDir, context.extensionPath, imageCache, false);

  fs.writeFileSync(finalHtmlPath, fullHtml, "utf8");
  vscode.window.showInformationMessage(`HTML successfully exported to: ${path.basename(finalHtmlPath)}`);
  return finalHtmlPath;
}
