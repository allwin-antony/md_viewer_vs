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
 * Formats and packages a fully styled, self-contained HTML file.
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
