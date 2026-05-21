import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Inlines relative image paths in the rendered HTML as Base64 Data URIs.
 * This ensures the exported HTML is fully portable and self-contained.
 */
export function inlineLocalImages(
  html: string,
  imageCache: Map<string, string>
): string {
  let finalHtml = html;

  for (const [cacheKey, webviewUri] of imageCache.entries()) {
    try {
      const absolutePath = cacheKey.split("|")[1];
      if (fs.existsSync(absolutePath)) {
        const fileExt = path.extname(absolutePath).toLowerCase();
        let mimeType = "image/png";
        if (fileExt === ".jpg" || fileExt === ".jpeg") mimeType = "image/jpeg";
        else if (fileExt === ".gif") mimeType = "image/gif";
        else if (fileExt === ".svg") mimeType = "image/svg+xml";
        else if (fileExt === ".webp") mimeType = "image/webp";

        const imageBuffer = fs.readFileSync(absolutePath);
        const base64Data = imageBuffer.toString("base64");
        const base64Uri = `data:${mimeType};base64,${base64Data}`;

        finalHtml = finalHtml.split(webviewUri).join(base64Uri);
      }
    } catch (err) {
      console.error(`Failed to inline image: ${cacheKey}`, err);
    }
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

  // 1. Inline all local relative images as base64
  let bundledHtml = inlineLocalImages(htmlContent, imageCache);

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
