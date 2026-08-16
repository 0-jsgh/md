/**
 * md-viewer.js  —  v1 (visor de Markdown de solo lectura)
 * ─────────────────────────────────────────────────────────────────────────────
 * Este script renderiza un documento Markdown embebido y muestra dos botones
 * flotantes en la esquina inferior derecha: "Index" (navegación por títulos)
 * y "Light/Dark". No tiene edición, ni Open/Save, ni arrastrar-y-soltar — es
 * el visor que generan los .html exportados desde md-render.js con el botón
 * "HTML".
 *
 * Uso esperado en el HTML exportado (misma estructura que index.html, con
 * el markdown embebido tal cual, sin base64):
 *
 *   <script type="text/markdown">
 *     # Tu contenido aquí
 *   </script>
 *   <script src="md-viewer.js"></script>
 *
 * También acepta, por compatibilidad con versiones anteriores de
 * md-render.js, el formato con base64:
 *
 *   <script id="md-viewer-data" data-md-b64="<markdown en base64>"></script>
 *   <script src="md-viewer.js"></script>
 *
 * Estructura de carpeta esperada — md-viewer.js vive al MISMO NIVEL que el
 * .html exportado, igual que md-render.js, y comparte su misma carpeta
 * libs/ con marked.min.js y KaTeX:
 *
 *   📁 tu-carpeta/
 *   ├── documento.html
 *   ├── md-viewer.js   ← este archivo
 *   └── 📁 libs/
 *       ├── marked.min.js
 *       ├── katex.min.js
 *       ├── katex.min.css
 *       ├── auto-render.min.js
 *       └── 📁 fonts/      ← fuentes KaTeX (.woff2)
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  "use strict";

  /* ─── Ruta base de libs (relativa al script) ───
     md-viewer.js vive al mismo nivel que el .html, igual que md-render.js,
     así que sus libs (marked, KaTeX, etc.) están en la subcarpeta libs/. */
  const SCRIPT_DIR = (function () {
    const scripts = document.querySelectorAll("script[src]");
    for (const s of scripts) {
      if (s.src && s.src.includes("md-viewer")) {
        return s.src.substring(0, s.src.lastIndexOf("/") + 1);
      }
    }
    return "./";
  })();
  const LIB = SCRIPT_DIR + "libs/";
  const DEFAULT_TITLE = document.title || "md-viewer.js";

  /* ══════════════════════════════════════════════════════
     1. ESTILOS (subconjunto de md-render.js: solo lo que
        necesita un visor — sin barra, sin editor)
  ══════════════════════════════════════════════════════ */
  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #181818;
      --surface:     #292929;
      --border:      #383838;
      --accent:      #7f7f7f;
      --accent2:     #56cfb2;
      --text:        #e2e4ef;
      --muted:       #8b90a8;
      --code-bg:     #0b0b0b;
      --inline-bg:   #181818;
      --heading:     #ffffff;
      --danger:      #f87171;
      --radius:      8px;
      --max-w:       840px;

      --tok-comment:  #6b7280;
      --tok-string:   #a3e635;
      --tok-number:   #fb923c;
      --tok-keyword:  #8000ff;
      --tok-literal:  #f472b6;
      --tok-function: #60a5fa;
      --tok-tag:      #f472b6;
      --tok-attr:     #fbbf24;
      --tok-property: #5eead4;
      --tok-punct:    #8b90a8;

      --task-done:        #cacaca;
      --task-done-bg:     rgba(197, 198, 197, 0.1);
    }

    html[data-theme="light"] {
      --bg:          #f7f7fb;
      --surface:     #ffffff;
      --border:      #e1e3ea;
      --accent:      #7f7f7f;
      --accent2:     #0e9488;
      --text:        #1d2029;
      --muted:       #6b7080;
      --code-bg:     #f1f1f5;
      --inline-bg:   #ececf3;
      --heading:     #12141c;
      --danger:      #dc2626;

      --tok-comment:  #8a8f9c;
      --tok-string:   #15803d;
      --tok-number:   #c2410c;
      --tok-keyword:  #7e22ce;
      --tok-literal:  #be185d;
      --tok-function: #1d4ed8;
      --tok-tag:      #be185d;
      --tok-attr:     #b45309;
      --tok-property: #0f766e;
      --tok-punct:    #6b7080;

      --task-done:        #cacaca;
      --task-done-bg:     rgba(40, 41, 40, 0.1);
    }

    html {
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 16px;
      line-height: 1.75;
      -webkit-font-smoothing: antialiased;
      transition: background .15s, color .15s;
    }

    body { padding: 0; background: var(--bg); }

    p{text-align:justify;}

    #md-workspace {
      max-width: var(--max-w);
      margin: 0 auto;
      padding: 3rem 1.5rem 7rem;
      min-height: 100vh;
    }

    /* ── Botones flotantes (Index + Light/Dark), esquina inferior derecha ── */
    .md-floating-btns {
      position: fixed;
      bottom: 1.5em;
      right: 1.5em;
      display: flex;
      gap: .6em;
      z-index: 70;
    }
    .md-btn {
      display: inline-flex;
      align-items: center;
      gap: .5em;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: .5em 1em;
      font-size: .85rem;
      font-weight: 600;
      cursor: pointer;
      transition: filter .15s, background .15s;
      white-space: nowrap;
      font-family: inherit;
      box-shadow: 0 8px 22px rgba(0, 0, 0, .35);
    }
    .md-btn:hover { filter: brightness(1.1); }
    .md-btn:active { filter: brightness(.95); }
    .md-btn:disabled { opacity: .4; cursor: not-allowed; filter: none; }

    /* ── Panel de navegación por títulos (TOC), sobre el botón Index ── */
    #md-toc-panel {
      position: fixed;
      bottom: 4.6em;
      right: 1.5em;
      width: 260px;
      max-height: min(70vh, 480px);
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 12px 28px rgba(0, 0, 0, .3);
      padding: .4em 0;
      z-index: 60;
      display: none;
    }
    #md-toc-panel.open { display: block; }
    .md-toc-empty { padding: .8em 1em; color: var(--muted); font-size: .85rem; }
    .md-toc-item {
      display: block;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      color: var(--text);
      font-family: inherit;
      font-size: .85rem;
      padding: .42em 1em;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .md-toc-item:hover { background: var(--inline-bg); color: var(--accent); }
    .md-toc-item[data-level="1"] { font-weight: 700; }
    .md-toc-item[data-level="2"] { padding-left: 1.7em; }
    .md-toc-item[data-level="3"] { padding-left: 2.5em; font-size: .82rem; color: var(--muted); }
    .md-toc-item[data-level="4"] { padding-left: 3.3em; font-size: .8rem;  color: var(--muted); }
    .md-toc-item[data-level="5"] { padding-left: 4.1em; font-size: .78rem; color: var(--muted); }
    .md-toc-item[data-level="6"] { padding-left: 4.9em; font-size: .76rem; color: var(--muted); }

    /* ── Pantalla vacía (sin contenido embebido) ── */
    .md-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 1em;
      min-height: calc(100vh - 6rem);
      color: var(--muted);
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      padding: 3rem 1.5rem;
    }
    .md-empty .md-empty-icon { font-size: 2.5rem; opacity: .6; }
    .md-empty h2 { color: var(--text); font-size: 1.2rem; margin: 0; border: none; padding: 0; }
    .md-empty p { margin: 0; font-size: 1rem; max-width: 32em; }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 700;
      line-height: 1.25;
      margin-top: 2.2em;
      margin-bottom: .6em;
      color: var(--heading);
      letter-spacing: -.02em;
    }
    h1 { font-size: 2.25rem; border-bottom: 2px solid var(--accent); padding-bottom: .35em; }
    h2 { font-size: 1.6rem;  border-bottom: 1px solid var(--border); padding-bottom: .3em; }
    h3 { font-size: 1.25rem; color: var(--accent2); }
    h4 { font-size: 1.05rem; }

    p  { margin-bottom: 1.1em; }
    hr { border: none; border-top: 1px solid var(--border); margin: 2.5em 0; }

    strong { font-weight: 600; color: var(--heading); }
    em     { color: var(--accent2); font-style: italic; }

    a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color .15s;
    }
    a:hover { border-bottom-color: var(--accent); }

    ul, ol { padding-left: 1.6em; margin-bottom: 1.1em; }
    li { margin-bottom: .35em; }
    li > ul, li > ol { margin-top: .25em; margin-bottom: .25em; }
    ul li::marker { color: var(--accent); }
    ol li::marker { color: var(--muted); font-size: .9em; }

    li.task-item { list-style: none; }
    li.task-done > input[type="checkbox"] { accent-color: var(--task-done); }
    li.task-done {
      background: var(--task-done-bg);
      border-radius: 4px;
      padding: .12em .5em;
      margin-left: -.5em;
    }

    blockquote {
      border-left: 3px solid var(--accent);
      background: var(--surface);
      margin: 1.5em 0;
      padding: .8em 1.2em;
      border-radius: 0 var(--radius) var(--radius) 0;
      color: var(--muted);
      font-style: italic;
    }
    blockquote p { margin: 0; }

    code {
      font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
      font-size: .85em;
      background: var(--inline-bg);
      color: var(--accent2);
      padding: .15em .45em;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .md-code-block {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin: 1.5em 0;
      overflow: hidden;
    }
    .md-code-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: .75em;
      padding: .45em .9em;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .md-code-lang {
      margin-right: auto;
      font-family: ui-monospace, monospace;
      font-size: .7rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .md-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: .4em;
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: .25em .7em;
      font-size: .72rem;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: color .15s, border-color .15s;
    }
    .md-copy-btn:hover { color: var(--text); border-color: var(--accent); }
    .md-copy-btn.md-copied { color: var(--accent2); border-color: var(--accent2); }
    pre {
      padding: 1.2em 1.4em;
      overflow-x: auto;
      position: relative;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
      color: var(--text);
      font-size: .875rem;
      line-height: 1.65;
    }

    .tok-comment  { color: var(--tok-comment); font-style: italic; }
    .tok-string   { color: var(--tok-string); }
    .tok-number   { color: var(--tok-number); }
    .tok-keyword  { color: var(--tok-keyword); font-weight: 600; }
    .tok-literal  { color: var(--tok-literal); }
    .tok-function { color: var(--tok-function); }
    .tok-tag      { color: var(--tok-tag); }
    .tok-attr     { color: var(--tok-attr); }
    .tok-property { color: var(--tok-property); }
    .tok-punct    { color: var(--tok-punct); }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      font-size: .93em;
    }
    thead tr { background: var(--surface); }
    th {
      text-align: left;
      padding: .65em 1em;
      border-bottom: 2px solid var(--accent);
      color: var(--accent);
      font-weight: 600;
      font-size: .85rem;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    td { padding: .6em 1em; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface); }

    img {
      max-width: 100%;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      display: block;
      margin: 1.5em auto;
    }

    input[type="checkbox"] { accent-color: var(--accent); margin-right: .45em; }
    input[type="checkbox"]:checked { accent-color: var(--task-done); }

    .katex { color: var(--text) !important; font-size: 1.05em; }
    .katex-display { margin: 1.5em 0; overflow-x: auto; overflow-y: hidden; }
    .katex-display > .katex { display: block; text-align: center; }

    ::-webkit-scrollbar       { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    @media (max-width: 600px) {
      #md-workspace { padding: 1.5rem 1rem 6rem; }
      h1   { font-size: 1.75rem; }
      h2   { font-size: 1.3rem; }
      table { font-size: .8em; }
    }

    /* ── Impresión: siempre tonos claros, sin botones flotantes ── */
    @media print {
      :root {
        --bg: #ffffff; --surface: #f4f4f6; --border: #dddfe6;
        --accent: #5c5c5c; --accent2: #0e8f6d; --text: #1a1d27;
        --muted: #5b6072; --code-bg: #f6f6f8; --inline-bg: #eef0f5;
        --heading: #101218;
        --task-done: #cacaca; --task-done-bg: rgba(41, 41, 41, 0.1);
      }
      .md-floating-btns, #md-toc-panel { display: none !important; }
      #md-workspace { max-width: 100% !important; padding: 0 !important; }
      body { background: #fff !important; }
      pre, table, blockquote, img { break-inside: avoid; }
    }
  `;

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const katexCss = document.createElement("link");
    katexCss.rel = "stylesheet";
    katexCss.href = LIB + "katex.min.css";
    document.head.appendChild(katexCss);
  }

  /* ─── Favicon: círculo morado, generado en runtime ─── */
  function setFavicon() {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="28" fill="%23ffffff"/>' +
      "</svg>";
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = "data:image/svg+xml," + svg;
  }

  /* ══════════════════════════════════════════════════════
     2. FUENTE MARKDOWN (base64 de md-render.js, o embebido clásico)
  ══════════════════════════════════════════════════════ */
  function base64ToUtf8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function getMarkdownSource() {
    const dataEl = document.getElementById("md-viewer-data");
    if (dataEl && dataEl.hasAttribute("data-md-b64")) {
      try {
        return base64ToUtf8(dataEl.getAttribute("data-md-b64"));
      } catch (e) {
        console.error("[md-viewer] No se pudo decodificar el markdown embebido.", e);
      }
    }
    const mdScript = document.querySelector('script[type="text/markdown"]');
    if (mdScript) return mdScript.textContent;
    const mdPre = document.getElementById("md-source");
    if (mdPre) return mdPre.textContent;
    return null;
  }

  /* ══════════════════════════════════════════════════════
     3. CARGA DE SCRIPTS LOCALES (una sola vez, cacheada)
  ══════════════════════════════════════════════════════ */
  const scriptCache = {};
  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar: " + src));
      document.head.appendChild(s);
    });
    return scriptCache[src];
  }

  /* ══════════════════════════════════════════════════════
     4a. RESALTADO DE SINTAXIS EN BLOQUES DE CÓDIGO (```lang)
     Motor genérico por regex, sin dependencias externas.
  ══════════════════════════════════════════════════════ */
  function tokenizeCode(code, rules) {
    if (!rules || !rules.length) return escapeHtml(code);
    const combined = new RegExp(
      rules.map((r, i) => "(?<t" + i + ">" + r.re.source + ")").join("|"),
      "g"
    );
    let out = "";
    let last = 0;
    let m;
    while ((m = combined.exec(code)) !== null) {
      if (m.index > last) out += escapeHtml(code.slice(last, m.index));
      for (let i = 0; i < rules.length; i++) {
        if (m.groups["t" + i] !== undefined) {
          out += '<span class="tok-' + rules[i].type + '">' + escapeHtml(m.groups["t" + i]) + "</span>";
          break;
        }
      }
      last = combined.lastIndex;
      if (m[0] === "") combined.lastIndex++;
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  function kw(list) {
    return new RegExp("\\b(?:" + list.split(/\s+/).join("|") + ")\\b");
  }

  function clikeGrammar(keywords) {
    return [
      { type: "comment", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/ },
      { type: "number", re: /\b0[xX][\da-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/ },
      { type: "keyword", re: kw(keywords) },
      { type: "literal", re: /\b(?:true|false|null|undefined|nil|None|True|False|NaN)\b/ },
      { type: "function", re: /\b[A-Za-z_$][\w$]*(?=\s*\()/ },
      { type: "punct", re: /[{}()\[\];,.:]/ },
    ];
  }

  const GRAMMARS = {
    javascript: clikeGrammar(
      "break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new return static super switch this throw try typeof var void while with yield async await of"
    ),
    typescript: clikeGrammar(
      "break case catch class const continue debugger default delete do else enum export extends finally for from function if implements import in instanceof interface let new private protected public readonly return static super switch this throw try type typeof var void while with yield async await of namespace declare as"
    ),
    java: clikeGrammar(
      "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while"
    ),
    c: clikeGrammar(
      "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while"
    ),
    csharp: clikeGrammar(
      "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while"
    ),
    go: clikeGrammar(
      "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var"
    ),
    rust: clikeGrammar(
      "as break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await"
    ),
    php: clikeGrammar(
      "abstract and array as break case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally for foreach function global goto if implements include instanceof insteadof interface isset list namespace new or print private protected public require return static switch throw trait try use var while xor yield"
    ),
    bash: [
      { type: "comment", re: /#[^\n]*/ },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'[^']*'/ },
      { type: "keyword", re: kw("if then elif else fi for while until do done case esac function in return break continue exit local export readonly declare select") },
      { type: "function", re: /\$\{?\w+\}?/ },
      { type: "punct", re: /[|&;()<>{}]/ },
    ],
    python: [
      { type: "comment", re: /#[^\n]*/ },
      { type: "string", re: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/ },
      { type: "number", re: /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/ },
      { type: "keyword", re: kw("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield") },
      { type: "function", re: /\b[A-Za-z_]\w*(?=\s*\()/ },
      { type: "punct", re: /[{}()\[\]:,.]/ },
    ],
    ruby: [
      { type: "comment", re: /#[^\n]*/ },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
      { type: "number", re: /\b\d+\.?\d*\b/ },
      { type: "keyword", re: kw("def end class module if elsif else unless while until for in do begin rescue ensure return yield self nil true false and or not case when then require require_relative attr_accessor") },
      { type: "function", re: /\b[a-z_]\w*(?=\s*\()/ },
      { type: "punct", re: /[{}()\[\],.]/ },
    ],
    sql: [
      { type: "comment", re: /--[^\n]*|\/\*[\s\S]*?\*\// },
      { type: "string", re: /'(?:''|[^'])*'/ },
      { type: "number", re: /\b\d+\.?\d*\b/ },
      { type: "keyword", re: kw("SELECT FROM WHERE JOIN INNER LEFT RIGHT OUTER ON GROUP BY ORDER HAVING INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX VIEW AS DISTINCT LIMIT OFFSET UNION ALL AND OR NOT NULL IS IN LIKE BETWEEN EXISTS CASE WHEN THEN END DEFAULT PRIMARY KEY FOREIGN REFERENCES select from where join inner left right outer on group by order having insert into values update set delete create table alter drop index view as distinct limit offset union all and or not null is in like between exists case when then end default primary key foreign references") },
      { type: "punct", re: /[(),;]/ },
    ],
    json: [
      { type: "property", re: /"(?:\\.|[^"\\])*"(?=\s*:)/ },
      { type: "string", re: /"(?:\\.|[^"\\])*"/ },
      { type: "number", re: /-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/ },
      { type: "literal", re: /\b(?:true|false|null)\b/ },
      { type: "punct", re: /[{}\[\],:]/ },
    ],
    css: [
      { type: "comment", re: /\/\*[\s\S]*?\*\// },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
      { type: "property", re: /[a-zA-Z-]+(?=\s*:)/ },
      { type: "number", re: /-?\b\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/ },
      { type: "punct", re: /[{}:;,]/ },
    ],
    html: [
      { type: "comment", re: /<!--[\s\S]*?-->/ },
      { type: "tag", re: /<\/?[a-zA-Z][\w-]*/ },
      { type: "attr", re: /[a-zA-Z-]+(?=\s*=)/ },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
      { type: "punct", re: /\/?>/ },
    ],
    yaml: [
      { type: "comment", re: /#[^\n]*/ },
      { type: "property", re: /^[ \t]*[\w.-]+(?=\s*:)/m },
      { type: "string", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
      { type: "literal", re: /\b(?:true|false|null|yes|no)\b/ },
      { type: "punct", re: /[:\-|>]/ },
    ],
  };

  const LANG_ALIASES = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", node: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", py3: "python",
    sh: "bash", shell: "bash", zsh: "bash", console: "bash",
    "c++": "cpp", cpp: "clike_cpp", cc: "clike_cpp", h: "c", hpp: "cpp",
    cs: "csharp", "c#": "csharp",
    rb: "ruby",
    yml: "yaml",
    htm: "html", xml: "html", svg: "html",
    scss: "css", less: "css",
    golang: "go",
    rs: "rust",
  };
  GRAMMARS.cpp = clikeGrammar(
    "alignas alignof and and_eq asm auto bitand bitor bool break case catch char class compl const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq"
  );

  function highlightCode(code, lang) {
    const key = (lang || "").toLowerCase().trim();
    const resolved = LANG_ALIASES[key] || key;
    const grammar = GRAMMARS[resolved === "clike_cpp" ? "cpp" : resolved];
    if (!grammar) return escapeHtml(code);
    return tokenizeCode(code, grammar);
  }

  /* ══════════════════════════════════════════════════════
     4. RENDERIZAR  (proteger LaTeX → Marked → restaurar)
     Mismo motor que md-render.js: bloques de código con botón de copiar,
     títulos con id navegable (para el panel Index) e imágenes con ancho
     opcional vía "![Descripción | 100](ruta)".
  ══════════════════════════════════════════════════════ */
  function renderMarkdown(raw) {
    const stash = [];
    let headingCounter = 0;

    const safe = raw
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
        stash.push({ type: "block", src: "$$" + m + "$$" });
        return "\x00LATEX_" + (stash.length - 1) + "\x00";
      })
      .replace(/\$([^\n$`]+?)\$/g, (_, m) => {
        stash.push({ type: "inline", src: "$" + m + "$" });
        return "\x00LATEX_" + (stash.length - 1) + "\x00";
      });

    const renderer = new marked.Renderer();
    renderer.code = function (token, infostring) {
      let text, lang;
      if (token !== null && typeof token === "object") {
        text = token.text;
        lang = token.lang || "";
      } else {
        text = token;
        lang = infostring || "";
      }
      const highlighted = highlightCode(text, lang);
      const langLabel = lang ? lang.split(/\s+/)[0] : "";
      const langSpan = langLabel ? '<span class="md-code-lang">' + escapeHtml(langLabel) + "</span>" : "";
      return (
        '<div class="md-code-block">' +
        '<div class="md-code-toolbar">' + langSpan +
        '<button type="button" class="md-copy-btn" data-copy-code>Copy</button>' +
        "</div>" +
        "<pre><code>" + highlighted + "</code></pre>" +
        "</div>\n"
      );
    };

    renderer.listitem = function (token, task, checked) {
      let text, isTask, isChecked;
      if (token !== null && typeof token === "object" && !Array.isArray(token)) {
        isTask = !!token.task;
        isChecked = !!token.checked;
        text = typeof token.text === "string" ? token.text : "";
        if (this && this.parser && token.tokens) {
          text = this.parser.parse(token.tokens, !!token.loose);
        }
      } else {
        text = token;
        isTask = !!task;
        isChecked = !!checked;
      }
      if (!isTask) return "<li>" + text + "</li>\n";
      const cls = isChecked ? "task-item task-done" : "task-item task-pending";
      return '<li class="' + cls + '">' + text + "</li>\n";
    };

    renderer.heading = function (token, level, raw2) {
      let text, depth;
      if (token !== null && typeof token === "object" && !Array.isArray(token)) {
        depth = token.depth;
        text = this && this.parser && token.tokens ? this.parser.parseInline(token.tokens) : token.text;
      } else {
        text = token;
        depth = level;
      }
      const id = "md-heading-" + headingCounter++;
      return '<h' + depth + ' id="' + id + '">' + text + "</h" + depth + ">\n";
    };

    renderer.link = function (token, title, text) {
      // Compatibilidad con dos firmas de marked:
      //  - v5+: link(token) donde token = { href, title, text/tokens }
      //  - v4-: link(href, title, text) con "text" ya renderizado
      let href, linkTitle, innerHtml;
      if (token !== null && typeof token === "object") {
        href = token.href;
        linkTitle = token.title;
        innerHtml = this && this.parser && token.tokens ? this.parser.parseInline(token.tokens) : token.text;
      } else {
        href = token;
        linkTitle = title;
        innerHtml = text;
      }
      innerHtml = innerHtml || "";

      // Sintaxis extendida: [Texto | #121212](url) o [Texto | red](url)
      // → color del texto del enlace (hex o nombre de color CSS).
      let color = null;
      const m = innerHtml.match(/^([\s\S]*)\|\s*([#a-zA-Z0-9]+)\s*$/);
      if (m && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/.test(m[2].trim())) {
        innerHtml = m[1].trim();
        color = m[2].trim();
      }

      const titleAttr = linkTitle ? ' title="' + escapeAttr(linkTitle) + '"' : "";
      const styleAttr = color ? ' style="color:' + escapeAttr(color) + ';"' : "";
      return '<a href="' + escapeAttr(href || "") + '"' + titleAttr + styleAttr + ">" + innerHtml + "</a>";
    };

    renderer.image = function (token, title, text) {
      let href, imgTitle, altText;
      if (token !== null && typeof token === "object") {
        href = token.href;
        imgTitle = token.title;
        altText = token.text;
      } else {
        href = token;
        imgTitle = title;
        altText = text;
      }
      altText = altText || "";

      let width = null;
      const m = altText.match(/^([\s\S]*)\|\s*(\d+)\s*$/);
      if (m) {
        altText = m[1].trim();
        width = m[2];
      }

      const styleAttr = width ? ' style="width:' + width + 'px;"' : "";
      const titleAttr = imgTitle ? ' title="' + escapeAttr(imgTitle) + '"' : "";
      return '<img src="' + escapeAttr(href || "") + '" alt="' + escapeAttr(altText) + '"' + titleAttr + styleAttr + ">";
    };

    marked.use({ renderer, gfm: true, breaks: false });

    let html = marked.parse(safe);
    html = html.replace(/\x00LATEX_(\d+)\x00/g, (_, i) => stash[+i].src);
    return html;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  /* ══════════════════════════════════════════════════════
     5. ESTADO + UI
  ══════════════════════════════════════════════════════ */
  let contentEl, tocPanelEl, tocBtn, modeBtn;
  let currentRaw = "";
  let currentHeadings = []; // [{ level, text, line }]

  function buildLayout() {
    document.body.innerHTML = "";
    document.documentElement.setAttribute("data-theme", "dark");

    const workspaceEl = document.createElement("div");
    workspaceEl.id = "md-workspace";
    document.body.appendChild(workspaceEl);

    contentEl = document.createElement("div");
    contentEl.id = "md-content";
    workspaceEl.appendChild(contentEl);

    const tocPanel = document.createElement("div");
    tocPanel.id = "md-toc-panel";
    document.body.appendChild(tocPanel);
    tocPanelEl = tocPanel;

    const floatingBtns = document.createElement("div");
    floatingBtns.className = "md-floating-btns";
    floatingBtns.innerHTML = `
      <button id="md-toc-btn" class="md-btn" type="button" disabled title="Navegar por títulos">Index</button>
      <button id="md-mode-btn" class="md-btn" type="button">Light</button>
    `;
    document.body.appendChild(floatingBtns);

    tocBtn = document.getElementById("md-toc-btn");
    modeBtn = document.getElementById("md-mode-btn");

    tocBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tocPanelEl.classList.toggle("open");
    });
    tocPanelEl.addEventListener("click", (e) => {
      const item = e.target.closest(".md-toc-item");
      if (!item) return;
      goToHeading(+item.dataset.index);
    });
    modeBtn.addEventListener("click", toggleTheme);

    setupCopyButtons();
  }

  /* ─── Botón de copiar en bloques de código ─── */
  function setupCopyButtons() {
    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copy-code]");
      if (!btn || !contentEl.contains(btn)) return;
      const codeEl = btn.closest(".md-code-block").querySelector("code");
      const text = codeEl ? codeEl.textContent : "";
      copyText(text)
        .then(() => showCopyFeedback(btn, true))
        .catch(() => showCopyFeedback(btn, false));
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("execCommand copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function showCopyFeedback(btn, ok) {
    const original = btn.textContent;
    btn.textContent = ok ? "Copied!" : "Error";
    btn.classList.toggle("md-copied", ok);
    clearTimeout(btn._copyResetTimer);
    btn._copyResetTimer = setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("md-copied");
    }, 1500);
  }

  /* ─── Navegación entre títulos (TOC): extracción, panel y salto ─── */
  function extractHeadings(raw) {
    const lines = raw.split("\n");
    const headings = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^ {0,3}```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = line.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (m) {
        headings.push({ level: m[1].length, text: m[2].trim() || "(sin título)", line: i });
      }
    }
    return headings;
  }

  function updateToc() {
    currentHeadings = extractHeadings(currentRaw);
    if (!currentHeadings.length) {
      tocBtn.disabled = true;
      tocPanelEl.innerHTML = '<div class="md-toc-empty">Sin títulos</div>';
      tocPanelEl.classList.remove("open");
      return;
    }
    tocBtn.disabled = false;
    tocPanelEl.innerHTML = currentHeadings
      .map(
        (h, i) =>
          '<button type="button" class="md-toc-item" data-level="' + h.level + '" data-index="' + i + '">' +
          escapeHtml(h.text) +
          "</button>"
      )
      .join("");
  }

  function goToHeading(index) {
    const heading = currentHeadings[index];
    if (!heading) return;
    const el = contentEl.querySelector("#md-heading-" + index);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showEmpty() {
    contentEl.innerHTML = `
      <div class="md-empty">
        <div class="md-empty-icon">📄</div>
        <h2>Ningún documento embebido</h2>
        <p>Este visor espera un &lt;script type="text/markdown"&gt; con el contenido (generado por md-render.js al exportar a HTML), o por compatibilidad, un &lt;script id="md-viewer-data" data-md-b64="..."&gt;.</p>
      </div>`;
    document.title = DEFAULT_TITLE;
    tocBtn.disabled = true;
  }

  /* ══════════════════════════════════════════════════════
     6. RENDER + KATEX
  ══════════════════════════════════════════════════════ */
  let katexReadyPromise = null;

  async function ensureKatex() {
    if (!katexReadyPromise) {
      katexReadyPromise = loadScript(LIB + "katex.min.js")
        .then(() => loadScript(LIB + "auto-render.min.js"))
        .catch((e) => {
          console.warn("[md-viewer] KaTeX no disponible, LaTeX no se renderizará.", e);
        });
    }
    return katexReadyPromise;
  }

  async function renderPreview() {
    contentEl.innerHTML = renderMarkdown(currentRaw);
    await ensureKatex();
    if (window.renderMathInElement) {
      renderMathInElement(contentEl, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  /* ══════════════════════════════════════════════════════
     7. TEMA OSCURO / CLARO
  ══════════════════════════════════════════════════════ */
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    modeBtn.textContent = next === "dark" ? "Light" : "Dark";
  }

  /* ══════════════════════════════════════════════════════
     8. MAIN
  ══════════════════════════════════════════════════════ */
  async function init() {
    injectStyles();
    setFavicon();
    buildLayout();

    try {
      await loadScript(LIB + "marked.min.js");
    } catch (e) {
      contentEl.innerHTML = `<div class="md-empty"><div class="md-empty-icon">⚠️</div><h2>Error</h2><p>No se encontró libs/marked.min.js</p></div>`;
      console.error(e);
      return;
    }

    const source = getMarkdownSource();
    if (!source || !source.trim()) {
      showEmpty();
      return;
    }

    currentRaw = source;
    document.title = DEFAULT_TITLE;
    await renderPreview();
    updateToc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
