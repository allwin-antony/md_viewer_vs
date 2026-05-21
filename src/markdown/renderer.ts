import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

const MarkdownIt = require("markdown-it");
const markdownItTaskLists = require("markdown-it-task-lists");
const markdownItEmoji = require("markdown-it-emoji");
const hljs = require("highlight.js");

export class MarkdownRenderer {
  private md: any;
  private alertStack: string[] = [];

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,
      highlight: (str: string, lang: string) => {
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
          '<pre class="hljs"><code>' +
          this.md.utils.escapeHtml(str) +
          "</code></pre>"
        );
      },
    });

    this.configurePlugins();
  }

  private configurePlugins() {
    // 1. Source Line Numbers
    this.md.core.ruler.push("inject_line_numbers", (state: any) => {
      state.tokens.forEach((token: any) => {
        if (token.map) {
          token.attrSet("data-line", token.map[0]);
        }
      });
    });

    // 2. Math inline/block (LaTeX KaTeX preservation)
    this.md.inline.ruler.before("escape", "math_inline", this.mathInlineRule);
    this.md.block.ruler.before("fence", "math_block", this.mathBlockRule.bind(this));

    // 3. Custom Heading Open (IDs for TOC link spy)
    this.md.renderer.rules.heading_open = (
      tokens: any[],
      idx: number,
      options: any,
      env: any,
      self: any
    ) => {
      const token = tokens[idx];
      const contentToken = tokens[idx + 1];
      if (contentToken && contentToken.children) {
        const text = contentToken.children
          .filter((t: any) => t.type === "text" || t.type === "code_inline")
          .map((t: any) => t.content)
          .join("");
        token.attrSet("id", this.slugify(text));
      }
      return self.renderToken(tokens, idx, options);
    };

    // 4. Standard plugins
    this.md.use(markdownItTaskLists, { enabled: true, label: true });
    this.md.use(markdownItEmoji.full);

    // 5. Custom Code Fence Renderer for Diagrams (Mermaid/UML)
    const defaultFence =
      this.md.renderer.rules.fence ||
      function (tokens: any[], idx: number, options: any, env: any, self: any) {
        return self.renderToken(tokens, idx, options);
      };

    this.md.renderer.rules.fence = (
      tokens: any[],
      idx: number,
      options: any,
      env: any,
      self: any
    ) => {
      const token = tokens[idx];
      const info = (token.info || "").trim().toLowerCase();
      const line = token.map ? token.map[0] : "";

      if (info.startsWith("mermaid")) {
        let content = token.content;
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed && !trimmed.startsWith("%%")) {
            if (trimmed.endsWith(";")) {
              lines[i] = lines[i].substring(0, lines[i].lastIndexOf(";"));
            }
            break;
          }
        }
        content = lines.join("\n");
        const escaped = this.md.utils.escapeHtml(content);
        return `<div class="mermaid" data-line="${line}" data-original-code="${escaped}">${escaped}</div>`;
      }

      if (info === "wsd" || info === "websequence" || info === "sequence") {
        const translated = this.translateWsdToMermaid(token.content);
        const escaped = this.md.utils.escapeHtml(translated);
        return `<div class="mermaid" data-line="${line}" data-original-code="${escaped}">${escaped}</div>`;
      }

      if (info === "uml" || info === "plantuml") {
        let content = token.content
          .replace(/@startuml\s*/gi, "")
          .replace(/@enduml\s*/gi, "");
        const translated = this.translateWsdToMermaid(content);
        const escaped = this.md.utils.escapeHtml(translated);
        return `<div class="mermaid" data-line="${line}" data-original-code="${escaped}">${escaped}</div>`;
      }

      const rendered = defaultFence(tokens, idx, options, env, self);
      if (token.map && rendered.startsWith("<pre")) {
        return rendered.replace("<pre", `<pre data-line="${token.map[0]}"`);
      }
      return rendered;
    };

    // 6. Custom Alerts (Note, Warning, Caution, Tip, Important) callouts
    this.md.renderer.rules.blockquote_open = (
      tokens: any[],
      idx: number,
      options: any,
      env: any,
      self: any
    ) => {
      let isAlert = false;
      let type = "";

      let nextIdx = idx + 1;
      while (nextIdx < tokens.length && tokens[nextIdx].type !== "blockquote_close") {
        const token = tokens[nextIdx];
        if (token.type === "inline") {
          const match = token.content.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
          if (match) {
            isAlert = true;
            type = match[1].toUpperCase();

            // Strip from raw content
            token.content = token.content.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\r?\n)?/i, "");
            
            // Strip from parsed child elements
            if (token.children && token.children.length > 0) {
              const firstChild = token.children[0];
              if (firstChild.type === "text") {
                firstChild.content = firstChild.content.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\r?\n)?/i, "");
              }
            }
            break;
          }
        }
        nextIdx++;
      }

      if (isAlert) {
        this.alertStack.push(type);
        const token = tokens[idx];
        const line = token.map ? token.map[0] : "";
        return `<div class="alert-block alert-${type.toLowerCase()}" data-line="${line}">`;
      }

      this.alertStack.push("");
      return self.renderToken(tokens, idx, options);
    };

    this.md.renderer.rules.blockquote_close = (
      tokens: any[],
      idx: number,
      options: any,
      env: any,
      self: any
    ) => {
      const activeAlert = this.alertStack.pop();
      if (activeAlert) {
        return `</div>`;
      }
      return self.renderToken(tokens, idx, options);
    };
  }

  // --- KaTeX inline block parsers ---
  private mathInlineRule(state: any, silent: boolean): boolean {
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

  private mathBlockRule(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean
  ): boolean {
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
      this.md.utils.escapeHtml(
        state.getLines(startLine, nextLine + 1, state.blkIndent, true)
      ) +
      "</div>";
    state.line = nextLine + 1;
    return true;
  }

  // --- Helpers ---
  private slugify(s: string): string {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  private translateWsdToMermaid(content: string): string {
    const lines = content.split("\n");
    const mermaidLines = ["sequenceDiagram"];

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("@startuml") || trimmed.startsWith("@enduml")) {
        continue;
      }
      if (
        trimmed.startsWith("skinparam") ||
        trimmed.startsWith("style ") ||
        trimmed.startsWith("autonumber")
      ) {
        continue;
      }
      if (trimmed.toLowerCase().startsWith("title ")) {
        continue;
      }

      if (trimmed.includes("-->")) {
        trimmed = trimmed.replace("-->", "-->>");
      } else if (trimmed.includes("->")) {
        trimmed = trimmed.replace("->", "->>");
      }

      mermaidLines.push("    " + trimmed);
    }

    return mermaidLines.join("\n");
  }

  // --- Local resource and image resolver ---
  private resolveLocalImages(
    html: string,
    docDir: string,
    webview: vscode.Webview,
    imageCache: Map<string, string>
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
      }
    );
  }

  // --- YouTube integration card resolver ---
  private resolveYouTubeEmbeds(html: string): string {
    return html.replace(
      /<iframe\s+([^>]+?)>\s*<\/iframe>/gi,
      (match, attrs) => {
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        if (!srcMatch) return match;
        const src = srcMatch[1];

        const isYouTube = /youtube(?:-nocookie)?\.com|youtu\.be/i.test(src);
        if (!isYouTube) return match;

        const ytMatch = src.match(
          /(?:youtube(?:-nocookie)?\.com\/(?:embed|v)\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i
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
      }
    );
  }

  // --- Main compile interface ---
  public render(
    text: string,
    docDir: string,
    webview: vscode.Webview,
    imageCache: Map<string, string>
  ): string {
    let rendered = this.md.render(text);
    rendered = this.resolveLocalImages(rendered, docDir, webview, imageCache);
    rendered = this.resolveYouTubeEmbeds(rendered);
    return rendered;
  }
}
