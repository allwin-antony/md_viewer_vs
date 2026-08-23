import * as vscode from "vscode";
import * as path from "path";

export function getWebviewContent(
  body: string,
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  // Resolve local offline assets URIs
  const katexJsUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "katex", "katex.min.js"))
  );
  const katexCssUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "katex", "katex.min.css"))
  );
  const katexAutoRenderUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "katex", "auto-render.min.js"))
  );
  const highlightLightUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "highlight", "github.min.css"))
  );
  const highlightDarkUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "highlight", "github-dark.min.css"))
  );
  const morphdomUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "morphdom", "morphdom-umd.min.js"))
  );
  const mermaidUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "mermaid", "mermaid.min.js"))
  );

  // Load preview style customizations
  const config = vscode.workspace.getConfiguration("mdViewer.preview");
  const fontFamily = config.get<string>("fontFamily") || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const fontSize = config.get<string>("fontSize") || "14px";
  const lineHeight = config.get<string>("lineHeight") || "1.7";

  // Load PDF print customizations
  const pdfConfig = vscode.workspace.getConfiguration("mdViewer.pdf");
  const pageSize = pdfConfig.get<string>("pageSize") || "A4";
  const orientation = pdfConfig.get<string>("orientation") || "portrait";
  const margins = pdfConfig.get<string>("margins") || "normal";

  let marginValue = "15mm";
  if (margins === "compact") marginValue = "8mm";
  else if (margins === "academic") marginValue = "25.4mm";
  else if (margins === "none") marginValue = "0mm";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <!-- Local Offline Assets -->
    <link rel="stylesheet" href="${katexCssUri}">
    <script src="${katexJsUri}"></script>
    <script src="${katexAutoRenderUri}"></script>
    <link rel="stylesheet" href="${highlightLightUri}" id="highlight-light">
    <link rel="stylesheet" href="${highlightDarkUri}" id="highlight-dark">
    <script src="${morphdomUri}"></script>
    
    <style>
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
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px 32px;
            max-width: var(--content-max-width);
            margin: 0 auto;
            word-wrap: break-word;
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
        h1, h2, h3, h4, h5, h6 { margin-top: 28px; margin-bottom: 16px; font-weight: 600; line-height: 1.3; }
        h1 { font-size: 2em; border-bottom: 2px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
        a { color: var(--vscode-textLink-foreground); text-decoration: none; }
        a:hover { text-decoration: underline; }
        pre { background-color: var(--vscode-textCodeBlock-background); padding: 16px; border-radius: 6px; overflow: auto; position: relative; }
        code { font-family: 'Fira Code', 'Cascadia Code', monospace; background-color: var(--vscode-textCodeBlock-background); padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
        pre code { padding: 0; background-color: transparent; }
        img { max-width: 100%; height: auto; border-radius: 6px; cursor: zoom-in; transition: transform 0.2s ease; }
        img:hover { transform: scale(1.01); }
        blockquote { border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 4px 16px; color: var(--vscode-textBlockQuote-foreground); margin: 0 0 16px 0; background-color: rgba(128,128,128,0.05); }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; display: block; overflow-x: auto; }
        th, td { border: 1px solid var(--vscode-panel-border); padding: 8px 14px; text-align: left; }
        th { background-color: var(--vscode-textCodeBlock-background); font-weight: 600; }
        tr:nth-child(even) { background-color: rgba(128, 128, 128, 0.05); }
        .task-list-item { list-style-type: none; margin-left: -1.5em; display: flex; align-items: center; gap: 8px; }
        .task-list-item input[type="checkbox"] { margin: 0; width: 16px; height: 16px; cursor: pointer; }
        
        /* KaTeX overrides */
        .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; text-align: center; }
        html { scroll-behavior: smooth; }
        ::selection { background-color: var(--vscode-editor-selectionBackground); }
        .hljs { background: transparent !important; padding: 0 !important; }
        .selected-highlight {
            background-color: var(--vscode-editor-selectionHighlightBackground, rgba(128, 128, 128, 0.15)) !important;
            outline: 2px dashed var(--vscode-focusBorder, rgba(0, 122, 204, 0.5)) !important;
            outline-offset: 2px;
            border-radius: 4px;
            transition: background-color 0.15s ease, outline 0.15s ease;
        }

        /* Premium Alert Callout Blocks */
        .alert-block {
            padding: 16px 20px;
            margin: 20px 0;
            border-left: 4px solid var(--alert-border-color);
            background-color: var(--alert-bg-color);
            border-radius: 0 8px 8px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .alert-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 0.85em;
            margin-bottom: 8px;
            color: var(--alert-text-color);
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .alert-icon {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }
        .alert-content {
            color: var(--vscode-editor-foreground);
            font-size: 0.95em;
        }
        .alert-content p:first-child { margin-top: 0; }
        .alert-content p:last-child { margin-bottom: 0; }

        body.vscode-dark, body.vscode-high-contrast {
            --alert-bg-note: rgba(59, 130, 246, 0.08);
            --alert-border-note: #3b82f6;
            --alert-bg-tip: rgba(16, 185, 129, 0.08);
            --alert-border-tip: #10b981;
            --alert-bg-important: rgba(139, 92, 246, 0.08);
            --alert-border-important: #8b5cf6;
            --alert-bg-warning: rgba(245, 158, 11, 0.08);
            --alert-border-warning: #f59e0b;
            --alert-bg-caution: rgba(239, 68, 68, 0.08);
            --alert-border-caution: #ef4444;
        }
        body.vscode-light {
            --alert-bg-note: rgba(59, 130, 246, 0.05);
            --alert-border-note: #2563eb;
            --alert-bg-tip: rgba(16, 185, 129, 0.05);
            --alert-border-tip: #059669;
            --alert-bg-important: rgba(139, 92, 246, 0.05);
            --alert-border-important: #7c3aed;
            --alert-bg-warning: rgba(245, 158, 11, 0.05);
            --alert-border-warning: #d97706;
            --alert-bg-caution: rgba(239, 68, 68, 0.05);
            --alert-border-caution: #dc2626;
        }

        .alert-note { --alert-bg-color: var(--alert-bg-note); --alert-border-color: var(--alert-border-note); --alert-text-color: var(--alert-border-note); }
        .alert-tip { --alert-bg-color: var(--alert-bg-tip); --alert-border-color: var(--alert-border-tip); --alert-text-color: var(--alert-border-tip); }
        .alert-important { --alert-bg-color: var(--alert-bg-important); --alert-border-color: var(--alert-border-important); --alert-text-color: var(--alert-border-important); }
        .alert-warning { --alert-bg-color: var(--alert-bg-warning); --alert-border-color: var(--alert-border-warning); --alert-text-color: var(--alert-border-warning); }
        .alert-caution { --alert-bg-color: var(--alert-bg-caution); --alert-border-color: var(--alert-border-caution); --alert-text-color: var(--alert-border-caution); }

        /* Code Copy Button */
        .code-copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(128, 128, 128, 0.12);
            border: 1px solid rgba(128, 128, 128, 0.15);
            border-radius: 4px;
            color: var(--vscode-editor-foreground);
            opacity: 0;
            cursor: pointer;
            padding: 5px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.1s ease;
            z-index: 10;
        }
        pre:hover .code-copy-btn { opacity: 1; }
        .code-copy-btn:hover { background: rgba(128, 128, 128, 0.25); }
        .code-copy-btn:active { transform: scale(0.92); }
        .code-copy-btn svg { width: 14px; height: 14px; fill: currentColor; }

        /* Lightbox Image Zoom Overlay */
        .lightbox-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lightbox-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .lightbox-image {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 6px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
            transform: scale(0.95);
            transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: zoom-out;
        }
        .lightbox-overlay.active .lightbox-image {
            transform: scale(1);
        }
        .lightbox-close-btn {
            position: absolute;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #ffffff;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2010;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .lightbox-close-btn:hover {
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.3);
            transform: scale(1.1) rotate(90deg);
        }
        .lightbox-close-btn:active {
            transform: scale(0.95);
        }
        .lightbox-close-btn svg {
            width: 20px;
            height: 20px;
        }

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
        @page {
            size: ${pageSize} ${orientation};
            margin: ${marginValue};
        }
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
            max-width: 100% !important;
            height: auto !important;
            max-height: 650px !important;
            object-fit: contain !important;
            display: inline-block;
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

        /* Target Heading Pulse on Jump */
        @keyframes headingTargetPulse {
            0% {
                background-color: var(--vscode-editor-selectionHighlightBackground, rgba(0, 122, 204, 0.25));
                outline: 2px solid var(--vscode-focusBorder, #007acc);
                outline-offset: 4px;
                border-radius: 4px;
            }
            60% {
                background-color: var(--vscode-editor-selectionHighlightBackground, rgba(0, 122, 204, 0.2));
                outline: 2px solid var(--vscode-focusBorder, #007acc);
                outline-offset: 4px;
                border-radius: 4px;
            }
            100% {
                background-color: transparent;
                outline: 2px solid transparent;
                outline-offset: 4px;
            }
        }
        .heading-target-pulse {
            animation: headingTargetPulse 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        /* TOC inside minimap */
        .minimap-toc-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 10px;
            color: var(--vscode-editor-foreground);
            opacity: 0.65;
            font-size: 11.5px;
            border-radius: 4px;
            transition: all 0.15s ease;
            margin-bottom: 2px;
            cursor: pointer;
            border-left: 2px solid transparent;
            text-decoration: none !important;
            gap: 6px;
        }
        .minimap-toc-item .toc-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
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
        .toc-badge {
            font-size: 9.5px;
            font-weight: 600;
            padding: 1px 5px;
            border-radius: 8px;
            background: rgba(128, 128, 128, 0.18);
            color: var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.65));
            line-height: 1.2;
            flex-shrink: 0;
        }
        .minimap-toc-item.active .toc-badge {
            background: var(--vscode-textLink-foreground, #007acc);
            color: #ffffff;
        }
        .toc-h1 { padding-left: 8px; }
        .toc-h2 { padding-left: 18px; }
        .toc-h3 { padding-left: 28px; }
        .toc-h4 { padding-left: 38px; }
    </style>
</head>
<body>
    <div id="content">${body}</div>

    <!-- START_MINIMAP_TOGGLE -->
    <!-- Minimap Toggle Handle (only visible when collapsed) -->
    <div class="minimap-toggle-handle" id="minimapToggleHandle" title="Show Outline">
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
    </div>
    <!-- END_MINIMAP_TOGGLE -->

    <!-- START_MINIMAP_PANEL -->
    <!-- Minimap Panel -->
    <div class="minimap-panel" id="minimapPanel">
        <div class="minimap-header" style="height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));">
            <span style="font-weight: 600; font-size: 10.5px; letter-spacing: 1px; color: var(--vscode-sideBarTitle-foreground, #808080); text-transform: uppercase;">Outline</span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button class="minimap-action-btn" id="exportHtmlBtn" title="Export to Standalone HTML">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
                    </svg>
                </button>
                <button class="minimap-action-btn" id="exportPdfBtn" title="Export to PDF">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px; height:16px;">
                        <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V8H10c.83 0 1.5.67 1.5 1.5zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V8h2.5c.83 0 1.5.67 1.5 1.5v2zm4-1.5H19v1h1.5V12H19v1h-1.5V8h3v1.5zM9 9.5h1v1H9v-1zm5 1h1v1h-1v-1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/>
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
    <!-- END_MINIMAP_PANEL -->

    <!-- Image Lightbox Zoom Overlay -->
    <div class="lightbox-overlay" id="lightboxOverlay">
        <button class="lightbox-close-btn" id="lightboxCloseBtn" aria-label="Close image zoom" title="Close zoom">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
        <img class="lightbox-image" id="lightboxImage" src="" alt="Zoomed view">
    </div>

    <!-- Mermaid Local Offline Script -->
    <script src="${mermaidUri}"></script>
    <script>
        const vscodeApi = acquireVsCodeApi();
        let previewScrollTimeout = null;
        let isHostScrolling = false;
        let lastScrollTime = 0;
        let hostScrollResetTimeout = null;
        let isUserInteracting = false;

        // User interaction tracking
        window.addEventListener('mouseenter', () => { isUserInteracting = true; });
        window.addEventListener('mouseleave', () => { isUserInteracting = false; });
        window.addEventListener('focus', () => { isUserInteracting = true; });
        window.addEventListener('blur', () => { isUserInteracting = false; });
        window.addEventListener('wheel', () => { isUserInteracting = true; }, { passive: true });
        window.addEventListener('touchstart', () => { isUserInteracting = true; }, { passive: true });
        window.addEventListener('keydown', () => { isUserInteracting = true; });
        window.addEventListener('mousedown', () => { isUserInteracting = true; });

        function handlePreviewScroll() {
            if (isHostScrolling || !isUserInteracting) {
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
        let isInitialThemeSetup = true;
        let currentThemeIsDark = null;

        function updateTheme() {
            const isDark = document.body.classList.contains('vscode-dark') || 
                           document.body.classList.contains('vscode-high-contrast');
            
            if (isDark === currentThemeIsDark) {
                return;
            }
            currentThemeIsDark = isDark;

            if (isDark) {
                if (lightTheme) lightTheme.disabled = true;
                if (darkTheme) darkTheme.disabled = false;
            } else {
                if (lightTheme) lightTheme.disabled = false;
                if (darkTheme) darkTheme.disabled = true;
            }
            
            // Re-init Mermaid with contrast aware theme (only on subsequent dynamic shifts)
            if (!isInitialThemeSetup) {
                initializeMermaid();
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

            // Initialize Mermaid Contrast Theme
            initializeMermaid();
            
            // Attach Code block Copy Buttons
            attachCopyButtons();
            
            // Attach Lightbox event listeners to images
            attachLightbox();
        }

        function initializeMermaid() {
            if (window.mermaid) {
                const isDark = document.body.classList.contains('vscode-dark') || 
                               document.body.classList.contains('vscode-high-contrast');
                mermaid.initialize({ 
                    startOnLoad: false, 
                    securityLevel: 'loose', 
                    theme: isDark ? 'dark' : 'default' 
                });
                
                // Find unrendered mermaid blocks
                const mermaidBlocks = document.querySelectorAll('.mermaid');
                mermaidBlocks.forEach(el => {
                    // Reset original layout if morphed from morphdom
                    if (el.getAttribute('data-processed')) {
                        el.removeAttribute('data-processed');
                        const originalCode = el.getAttribute('data-original-code');
                        if (originalCode) {
                            el.textContent = originalCode;
                        } else {
                            el.textContent = el.textContent;
                        }
                    }
                    mermaid.init(undefined, el);
                });
            }
        }

        // Elegant Code Block Copy Utility
        function attachCopyButtons() {
            const preBlocks = document.querySelectorAll('pre');
            preBlocks.forEach(pre => {
                if (pre.querySelector('.code-copy-btn')) return; // already added

                const btn = document.createElement('button');
                btn.className = 'code-copy-btn';
                btn.title = 'Copy Code';
                btn.innerHTML = \`<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>\`;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const code = pre.querySelector('code');
                    const text = code ? code.innerText : pre.innerText;

                    navigator.clipboard.writeText(text).then(() => {
                        btn.innerHTML = \`<svg viewBox="0 0 24 24" style="fill:#10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>\`;
                        btn.title = 'Copied!';
                        setTimeout(() => {
                            btn.innerHTML = \`<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>\`;
                            btn.title = 'Copy Code';
                        }, 2000);
                    });
                });

                pre.appendChild(btn);
            });
        }

        // Image Lightbox zoom overlay
        const lightboxOverlay = document.getElementById('lightboxOverlay');
        const lightboxImage = document.getElementById('lightboxImage');

        function attachLightbox() {
            const images = document.querySelectorAll('#content img');
            images.forEach(img => {
                // Ignore small icon or placeholder tags, and don't lightbox images inside links
                if (
                    img.classList.contains('alert-icon') || 
                    img.classList.contains('yt-fallback-logo') ||
                    img.closest('a')
                ) return;
                
                // Prevent duplicate listeners
                img.removeEventListener('click', openLightbox);
                img.addEventListener('click', openLightbox);
            });
        }

        function openLightbox(e) {
            e.stopPropagation();
            lightboxImage.src = this.src;
            lightboxOverlay.classList.add('active');
        }

        // Close lightbox on click
        lightboxOverlay.addEventListener('click', () => {
            lightboxOverlay.classList.remove('active');
        });

        // Close lightbox via close button
        const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
        if (lightboxCloseBtn) {
            lightboxCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                lightboxOverlay.classList.remove('active');
            });
        }

        // Close lightbox on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightboxOverlay.classList.contains('active')) {
                lightboxOverlay.classList.remove('active');
            }
        });

        // Dynamic Table of Contents (TOC) builder
        function buildTableOfContents() {
            const tocList = document.getElementById('tocList');
            if (!tocList) return;

            const headings = Array.from(document.querySelectorAll('#content h1, #content h2, #content h3, #content h4'));
            if (headings.length === 0) {
                tocList.innerHTML = '<div style="opacity: 0.5; font-style: italic; text-align: center; padding: 20px; font-size: 11px; color: var(--vscode-editor-foreground);">No headings found</div>';
                return;
            }

            // Count occurrences of each heading title to identify duplicates
            const textCounts = new Map();
            headings.forEach(h => {
                const t = (h.textContent || '').trim();
                textCounts.set(t, (textCounts.get(t) || 0) + 1);
            });

            const textOccurrences = new Map();
            const slugCounts = new Map();

            tocList.innerHTML = headings.map(function(heading) {
                var rawText = (heading.textContent || '').trim();
                var id = heading.getAttribute('id');
                if (!id) {
                    var baseSlug = rawText.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') || 'section';
                    var sc = slugCounts.get(baseSlug) || 0;
                    slugCounts.set(baseSlug, sc + 1);
                    id = sc === 0 ? baseSlug : baseSlug + '-' + sc;
                    heading.setAttribute('id', id);
                }

                var totalMatches = textCounts.get(rawText) || 1;
                var currentIdx = (textOccurrences.get(rawText) || 0) + 1;
                textOccurrences.set(rawText, currentIdx);

                var badgeHtml = '';
                var lineAttr = heading.getAttribute('data-line');
                var lineInfo = lineAttr ? ' (Line ' + (parseInt(lineAttr, 10) + 1) + ')' : '';
                var titleTooltip = rawText;

                if (totalMatches > 1) {
                    badgeHtml = '<span class="toc-badge">#' + currentIdx + '</span>';
                    titleTooltip = rawText + ' [Section #' + currentIdx + ' of ' + totalMatches + ']' + lineInfo;
                } else if (lineInfo) {
                    titleTooltip = rawText + lineInfo;
                }

                var level = heading.tagName.toLowerCase(); // h1, h2, h3, h4
                var safeTooltip = titleTooltip.replace(/"/g, '&quot;');
                var safeText = rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                return '<a href="#' + id + '" class="minimap-toc-item toc-' + level + '" data-id="' + id + '" title="' + safeTooltip + '">' + 
                       '<span class="toc-text">' + safeText + '</span>' + badgeHtml + 
                       '</a>';
            }).join('');

            tocList.querySelectorAll('.minimap-toc-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = item.getAttribute('data-id');
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        targetEl.classList.remove('heading-target-pulse');
                        void targetEl.offsetWidth; // Force DOM reflow to restart CSS animation
                        targetEl.classList.add('heading-target-pulse');
                        setTimeout(() => {
                            targetEl.classList.remove('heading-target-pulse');
                        }, 1300);
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
                }, 150);
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

        // Listen for live incremental updates or export complete signals
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
                const htmlBtn = document.getElementById('exportHtmlBtn');
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
                if (htmlBtn) {
                    htmlBtn.classList.remove('loading');
                    htmlBtn.disabled = false;
                }
            } else if (message.command === 'scrollToLine') {
                const targetLine = message.line;
                
                const elements = Array.from(document.querySelectorAll('[data-line]'));
                if (elements.length === 0) return;
                
                let closestElement = null;
                let minDiff = Infinity;
                
                for (const el of elements) {
                    const line = parseInt(el.getAttribute('data-line'), 10);
                    const diff = targetLine - line;
                    
                    if (diff >= 0 && diff < minDiff) {
                        minDiff = diff;
                        closestElement = el;
                    }
                }
                
                if (!closestElement && elements.length > 0) {
                    closestElement = elements[0];
                }
                
                if (closestElement) {
                    isHostScrolling = true;
                    isUserInteracting = false;
                    if (hostScrollResetTimeout) {
                        clearTimeout(hostScrollResetTimeout);
                    }
                    closestElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(updateScrollSpy, 100);
                }
            } else if (message.command === 'selectLines') {
                const startLine = message.startLine;
                const endLine = message.endLine;
                
                // Clear any existing highlights first
                document.querySelectorAll('.selected-highlight').forEach(el => {
                    el.classList.remove('selected-highlight');
                });
                
                if (startLine === -1 || endLine === -1) {
                    return;
                }
                
                // Find all elements with data-line attributes
                const elements = Array.from(document.querySelectorAll('[data-line]'))
                    .map(el => ({
                        element: el,
                        line: parseInt(el.getAttribute('data-line'), 10)
                    }))
                    .filter(item => !isNaN(item.line))
                    .sort((a, b) => a.line - b.line);
                
                if (elements.length === 0) return;
                
                // Calculate span ranges and apply highlight
                for (let i = 0; i < elements.length; i++) {
                    const elData = elements[i];
                    const nextLine = (i + 1 < elements.length) ? elements[i + 1].line : Infinity;
                    const elEndLine = nextLine - 1;
                    
                    // Check if element range [elData.line, elEndLine] overlaps selection [startLine, endLine]
                    const overlaps = elData.line <= endLine && elEndLine >= startLine;
                    
                    if (overlaps) {
                        elData.element.classList.add('selected-highlight');
                    }
                }
            }
        });

        // Dynamic Interactive Task List Back-Propagation
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target && target.type === 'checkbox' && target.closest('.task-list-item')) {
                const parentWithLine = target.closest('[data-line]');
                if (parentWithLine) {
                    const line = parseInt(parentWithLine.getAttribute('data-line'), 10);
                    const checked = target.checked;
                    vscodeApi.postMessage({
                        command: 'toggleCheckbox',
                        line: line,
                        checked: checked
                    });
                }
            }
        });

        // Sync selections back to markdown editor on preview text selection
        document.addEventListener('selectionchange', () => {
            if (!isUserInteracting) return;
            
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                document.querySelectorAll('.selected-highlight').forEach(el => {
                    el.classList.remove('selected-highlight');
                });
                vscodeApi.postMessage({
                    command: 'editorSelect',
                    startLine: -1,
                    endLine: -1
                });
                return;
            }
            
            let startLine = Infinity;
            let endLine = -Infinity;
            
            for (let i = 0; i < selection.rangeCount; i++) {
                const range = selection.getRangeAt(i);
                const startEl = findNearestDataLineAncestor(range.startContainer);
                const endEl = findNearestDataLineAncestor(range.endContainer);
                
                if (startEl) {
                    const line = parseInt(startEl.getAttribute('data-line'), 10);
                    if (!isNaN(line)) {
                        startLine = Math.min(startLine, line);
                        endLine = Math.max(endLine, line);
                    }
                }
                if (endEl) {
                    const line = parseInt(endEl.getAttribute('data-line'), 10);
                    if (!isNaN(line)) {
                        startLine = Math.min(startLine, line);
                        endLine = Math.max(endLine, line);
                    }
                }
            }
            
            if (startLine !== Infinity && endLine !== -Infinity) {
                vscodeApi.postMessage({
                    command: 'editorSelect',
                    startLine: startLine,
                    endLine: endLine
                });
            }
        });

        function findNearestDataLineAncestor(node) {
            let current = node;
            while (current && current !== document.body) {
                if (current.nodeType === Node.ELEMENT_NODE && current.hasAttribute('data-line')) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        }

        // Initial render
        renderMathAndMermaid();
        buildTableOfContents();
        isInitialThemeSetup = false;

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
                // Let VS Code's native webview handle external HTTP/HTTPS links naturally.
                // This prevents the page from opening twice in the default browser.
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

            const htmlContent = document.documentElement.outerHTML;
            vscodeApi.postMessage({
                command: 'exportPdfHtml',
                html: htmlContent
            });
        });

        // Standalone HTML Export click listener
        document.getElementById('exportHtmlBtn').addEventListener('click', () => {
            const btn = document.getElementById('exportHtmlBtn');
            btn.classList.add('loading');
            btn.disabled = true;

            const htmlContent = document.documentElement.outerHTML;
            vscodeApi.postMessage({
                command: 'exportStandaloneHtml',
                html: htmlContent
            });
        });
    </script>
</body>
</html>`;
}
