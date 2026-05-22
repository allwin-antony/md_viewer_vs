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

/**
 * Runs Google Chrome in headless mode to render an HTML file directly to PDF.
 */
export function exportToPdf(
  chromeExecutable: string,
  tempHtmlPath: string,
  targetPdfPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chromeCmd = `"${chromeExecutable}" --headless --disable-gpu --no-sandbox --no-pdf-header-footer --print-to-pdf="${targetPdfPath}" "${tempHtmlPath}"`;

    cp.exec(chromeCmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve();
      }
    });
  });
}
