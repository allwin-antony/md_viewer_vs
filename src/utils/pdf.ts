import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";

/**
 * Automatically searches for Google Chrome, Chromium, or Microsoft Edge executables based on OS.
 */
export function findChromePath(): string {
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

    // Direct check for common Snap and Flatpak installations in standard absolute paths
    const absoluteFallbacks = [
      "/snap/bin/google-chrome",
      "/snap/bin/google-chrome-stable",
      "/snap/bin/chromium",
      "/snap/bin/microsoft-edge",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
    ];
    for (const p of absoluteFallbacks) {
      if (fs.existsSync(p)) return p;
    }
  }

  // Final fallback (just executable name, hoping it's in the PATH)
  return platform === "win32" ? "chrome.exe" : "google-chrome";
}

import { generateExportHtml } from "./html";

/**
 * Runs Google Chrome in headless mode to render an HTML file directly to PDF.
 */
export function exportToPdf(
  chromeExecutable: string,
  tempHtmlPath: string,
  targetPdfPath: string,
  includeHeaderFooter: boolean = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const headerFooterFlag = includeHeaderFooter ? "" : "--no-pdf-header-footer";
    // --virtual-time-budget=2000 & --run-all-compositor-stages-before-draw gives async JS (KaTeX, Mermaid SVGs) time to finish rendering before snapshot
    const chromeCmd = `"${chromeExecutable}" --headless --disable-gpu --no-sandbox --allow-file-access-from-files --enable-local-file-accesses --run-all-compositor-stages-before-draw --virtual-time-budget=2000 ${headerFooterFlag} --print-to-pdf="${targetPdfPath}" "${tempHtmlPath}"`;

    cp.exec(chromeCmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Programmatically exports a Markdown document to PDF.
 * If targetPath is provided (by AI or script), skips GUI save dialog.
 * Returns the output PDF path string, or undefined if cancelled.
 */
export async function exportDocumentToPdf(
  doc: vscode.TextDocument,
  context: vscode.ExtensionContext,
  renderer: { renderHeadless: (text: string, docDir: string, cache: Map<string, string>) => string },
  targetPath?: string | vscode.Uri
): Promise<string | undefined> {
  const docDir = path.dirname(doc.uri.fsPath);
  const defaultName = path.basename(doc.uri.fsPath, path.extname(doc.uri.fsPath)) + ".pdf";

  let finalPdfPath: string;
  if (targetPath) {
    finalPdfPath = typeof targetPath === "string" ? targetPath : targetPath.fsPath;
  } else {
    const saveOptions: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.file(path.join(docDir, defaultName)),
      filters: { "PDF Files": ["pdf"] },
      title: "Export to PDF",
    };
    const fileUri = await vscode.window.showSaveDialog(saveOptions);
    if (!fileUri) return undefined;
    finalPdfPath = fileUri.fsPath;
  }

  const imageCache = new Map<string, string>();
  const bodyHtml = renderer.renderHeadless(doc.getText(), docDir, imageCache);
  const fullHtml = generateExportHtml(bodyHtml, docDir, context.extensionPath, imageCache, true);

  const pdfConfig = vscode.workspace.getConfiguration("mdViewer.pdf");
  const includeHeaderFooter = pdfConfig.get<boolean>("headerFooter", false);

  const tempHtmlPath = path.join(docDir, `temp_preview_${Date.now()}.html`);
  try {
    fs.writeFileSync(tempHtmlPath, fullHtml, "utf8");
    const chromeExecutable = findChromePath();
    await exportToPdf(chromeExecutable, tempHtmlPath, finalPdfPath, includeHeaderFooter);
    vscode.window.showInformationMessage(`PDF successfully exported to: ${path.basename(finalPdfPath)}`);
    return finalPdfPath;
  } catch (err: any) {
    const isNotFoundError =
      err.message.includes("ENOENT") ||
      err.message.includes("not found") ||
      err.message.includes("is not recognized");
    let errorMsg = `Failed to export PDF: ${err.message}`;
    if (isNotFoundError) {
      errorMsg = `Failed to export PDF: Google Chrome or Chromium executable could not be found. Please configure mdViewer.chromePath in settings.`;
    }
    vscode.window.showErrorMessage(errorMsg, "Configure Chrome Path").then((selection) => {
      if (selection === "Configure Chrome Path") {
        vscode.commands.executeCommand("workbench.action.openSettings", "mdViewer.chromePath");
      }
    });
    throw err;
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (_) {}
    }
  }
}
