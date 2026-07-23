/**
 * md-render.js  —  v6 offline (resaltado extendido, favicon, indicador de cambios)
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso en el HTML (igual que antes, el contenido embebido es opcional):
 *
 *   <script type="text/markdown">
 *     # Tu contenido aquí
 *   </script>
 *   <script src="md-render.js"></script>
 *
 * Novedades v6 (sobre v5):
 *   - Resaltado del editor ampliado: además de títulos y separadores, ahora
 *     colorea todo lo que esté entre $...$ y $$...$$ (LaTeX), y entre
 *     *...* y **...** (cursiva / negrita).
 *   - Cuando hay cambios sin guardar, el nombre del archivo en la barra
 *     superior se pinta de rojo (en vez de mostrar el texto "unsaved").
 *   - Favicon: círculo morado sólido, generado en runtime (sin archivos
 *     extra), así el proyecto sigue siendo una sola carpeta autocontenida.
 *
 * Novedades v5:
 *   - Barra reorganizada: izquierda [Open, Edit/View] — derecha [Save,
 *     Export PDF, Mode]. Modo oscuro/claro. Export PDF vía impresión nativa
 *     forzando siempre tonos claros.
 *
 * Novedades v4: toggle Editar/Vista previa + Guardar (.md).
 * Novedades v3: Abrir .md (File API) + arrastrar y soltar.
 *
 * Estructura de carpeta esperada (todo al mismo nivel):
 *   📁 tu-carpeta/
 *   ├── tu-doc.html
 *   ├── md-render.js
 *   └── 📁 libs/
 *       ├── marked.min.js
 *       ├── katex.min.js
 *       ├── katex.min.css
 *       ├── auto-render.min.js
 *       └── 📁 fonts/   ← fuentes KaTeX (.woff2)
 *
 * Nota sobre imágenes: al abrir un .md externo, las rutas relativas
 * (![](img.png)) no se resuelven solas porque el navegador solo tiene
 * acceso al contenido del archivo, no a su carpeta. Usá rutas absolutas o
 * imágenes embebidas en base64 si el documento las necesita.
 *
 * Nota sobre guardar/exportar: "Save" siempre descarga un archivo nuevo (no
 * sobrescribe el original en disco), y "Export PDF" usa el diálogo de
 * impresión nativo — elegí "Guardar como PDF" como destino de impresión.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  "use strict";

  /* ─── Ruta base de libs (relativa al script) ─── */
  const SCRIPT_DIR = (function () {
    const scripts = document.querySelectorAll("script[src]");
    for (const s of scripts) {
      if (s.src && s.src.includes("md-render")) {
        return s.src.substring(0, s.src.lastIndexOf("/") + 1);
      }
    }
    return "./";
  })();
  const LIB = SCRIPT_DIR + "libs/";
  const DEFAULT_TITLE = document.title || "md-render.js";

  /* ══════════════════════════════════════════════════════
     1. ESTILOS
  ══════════════════════════════════════════════════════ */
  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #0f1117;
      --surface:     #1a1d27;
      --border:      #2a2d3a;
      --accent:      #7c6af7;
      --accent2:     #56cfb2;
      --text:        #e2e4ef;
      --muted:       #8b90a8;
      --code-bg:     #12141e;
      --inline-bg:   #1e2130;
      --heading:     #ffffff;
      --toolbar-bg:  rgba(26, 29, 39, .92);
      --overlay-bg:  rgba(15, 17, 23, .88);
      --danger:      #f87171;
      --radius:      8px;
      --max-w:       780px;
      --toolbar-h:   52px;

      --hl-h1: #a78bfa; --hl-h2: #5eead4; --hl-h3: #fbbf24;
      --hl-h4: #f472b6; --hl-h5: #60a5fa; --hl-h6: #9ca3af;
      --hl-hr: #fb7185;
      --hl-math: #38bdf8; --hl-bold: #fde68a; --hl-italic: #c4b5fd;

      --tok-comment:  #6b7280;
      --tok-string:   #a3e635;
      --tok-number:   #fb923c;
      --tok-keyword:  #c084fc;
      --tok-literal:  #f472b6;
      --tok-function: #60a5fa;
      --tok-tag:      #f472b6;
      --tok-attr:     #fbbf24;
      --tok-property: #5eead4;
      --tok-punct:    #8b90a8;
    }

    html[data-theme="light"] {
      --bg:          #f7f7fb;
      --surface:     #ffffff;
      --border:      #e1e3ea;
      --accent:      #6d5bd0;
      --accent2:     #0e9488;
      --text:        #1d2029;
      --muted:       #6b7080;
      --code-bg:     #f1f1f5;
      --inline-bg:   #ececf3;
      --heading:     #12141c;
      --toolbar-bg:  rgba(255, 255, 255, .92);
      --overlay-bg:  rgba(255, 255, 255, .88);
      --danger:      #dc2626;

      --hl-h1: #6d28d9; --hl-h2: #0f766e; --hl-h3: #b45309;
      --hl-h4: #be185d; --hl-h5: #1d4ed8; --hl-h6: #6b7280;
      --hl-hr: #e11d48;
      --hl-math: #0369a1; --hl-bold: #92661b; --hl-italic: #7c3aed;

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

    /* ── Barra superior ── */
    #md-toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      height: var(--toolbar-h);
      display: flex;
      align-items: center;
      gap: .6em;
      padding: 0 1.25em;
      background: var(--toolbar-bg);
      backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--border);
    }
    .md-toolbar-group { display: flex; align-items: center; gap: .5em; flex: 0 0 auto; }
    #md-toolbar .md-filename {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      font-size: .85rem;
      color: var(--muted);
    }
    #md-toolbar .md-filename strong { color: var(--text); font-weight: 500; transition: color .15s; }
    #md-toolbar .md-filename strong.md-name-dirty { color: var(--danger); }

    .md-btn {
      display: inline-flex;
      align-items: center;
      gap: .5em;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: .5em 1em;
      font-size: .85rem;
      font-weight: 600;
      cursor: pointer;
      transition: filter .15s, background .15s;
      white-space: nowrap;
      font-family: inherit;
    }
    .md-btn:hover { filter: brightness(1.1); }
    .md-btn:active { filter: brightness(.95); }
    .md-btn:disabled { opacity: .4; cursor: not-allowed; filter: none; }
    #md-open-btn { background: var(--accent); }
    #md-toggle-btn { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
    #md-save-btn { background: var(--accent2); color: #0f1117; }
    #md-export-btn { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
    #md-mode-btn { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
    #md-file-input { display: none; }

    /* ── Contenedor del contenido ── */
    #md-workspace {
      max-width: var(--max-w);
      margin: 0 auto;
      padding: 3rem 1.5rem 6rem;
      min-height: calc(100vh - var(--toolbar-h));
    }
    #md-workspace.editing { max-width: 100%; padding: 1.25rem 1.5rem 2rem; }

    #md-content { display: block; }
    #md-editor-wrap { display: none; }
    #md-workspace.editing #md-content { display: none; }
    #md-workspace.editing #md-editor-wrap { display: block; }

    /* ── Editor con resaltado de sintaxis (backdrop + textarea) ── */
    #md-editor-wrap {
      position: relative;
      height: calc(100vh - var(--toolbar-h) - 2.5rem);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--code-bg);
      overflow: hidden;
    }
    #md-editor-wrap:focus-within { border-color: var(--accent); }

    .md-editor-layer {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 1.2em 1.4em;
      font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
      font-size: .9rem;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre-wrap;
      word-wrap: break-word;
      box-sizing: border-box;
      border: none;
      background: transparent;
    }
    #md-highlight {
      color: var(--text);
      overflow: auto;
      pointer-events: none;
      scrollbar-width: none;
    }
    #md-highlight::-webkit-scrollbar { display: none; }
    #md-editor {
      color: transparent;
      caret-color: var(--text);
      resize: none;
      overflow: auto;
      outline: none;
    }

    #md-linenumbers {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 3em;
      margin: 0;
      padding: 1.2em .6em 1.2em 0;
      font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
      font-size: .9rem;
      line-height: 1.6;
      text-align: right;
      color: var(--muted);
      background: var(--code-bg);
      border-right: 1px solid var(--border);
      white-space: pre;
      overflow: hidden;
      user-select: none;
      pointer-events: none;
      box-sizing: border-box;
      z-index: 1;
    }
    .ln-active { color: var(--accent2); font-weight: 700; }

    .hl-h1, .hl-h2, .hl-h3, .hl-h4, .hl-h5, .hl-h6 { font-weight: 700; }
    .hl-h1 { color: var(--hl-h1); }
    .hl-h2 { color: var(--hl-h2); }
    .hl-h3 { color: var(--hl-h3); }
    .hl-h4 { color: var(--hl-h4); }
    .hl-h5 { color: var(--hl-h5); }
    .hl-h6 { color: var(--hl-h6); }
    .hl-hr { color: var(--hl-hr); font-weight: 700; letter-spacing: .15em; }
    .hl-fence { color: var(--muted); }
    .hl-math { color: var(--hl-math); }
    .hl-bold { color: var(--hl-bold); font-weight: 700; }
    .hl-italic { color: var(--hl-italic); font-style: italic; }

    /* ── Pantalla de bienvenida / drop zone vacía ── */
    .md-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 1em;
      min-height: calc(100vh - var(--toolbar-h) - 6rem);
      color: var(--muted);
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      padding: 3rem 1.5rem;
    }
    .md-empty .md-empty-icon { font-size: 2.5rem; opacity: .6; }
    .md-empty h2 { color: var(--text); font-size: 1.2rem; margin: 0; border: none; padding: 0; }
    .md-empty p { margin: 0; font-size: .9rem; max-width: 32em; }

    /* ── Overlay al arrastrar un archivo ── */
    #md-drop-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
      background: var(--overlay-bg);
      border: 3px dashed var(--accent);
    }
    #md-drop-overlay.active { display: flex; }
    #md-drop-overlay span { font-size: 1.3rem; font-weight: 600; color: var(--text); }

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

    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.2em 1.4em;
      overflow-x: auto;
      margin: 1.5em 0;
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
    pre[data-lang]::before {
      content: attr(data-lang);
      position: absolute;
      top: .55em;
      right: .9em;
      font-family: ui-monospace, monospace;
      font-size: .7rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
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

    .katex { color: var(--text) !important; font-size: 1.05em; }
    .katex-display { margin: 1.5em 0; overflow-x: auto; overflow-y: hidden; }
    .katex-display > .katex { display: block; text-align: center; }

    ::-webkit-scrollbar       { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    @media (max-width: 600px) {
      #md-workspace { padding: 1.5rem 1rem 4rem; }
      #md-toolbar { padding: 0 .75em; gap: .4em; flex-wrap: wrap; height: auto; min-height: var(--toolbar-h); }
      .md-btn { padding: .5em .75em; font-size: .8rem; }
      .md-filename { display: none; }
      h1   { font-size: 1.75rem; }
      h2   { font-size: 1.3rem; }
      table { font-size: .8em; }
    }

    /* ── Impresión / Export PDF: siempre tonos claros, sin importar el tema activo ── */
    @media print {
      :root {
        --bg: #ffffff; --surface: #f4f4f6; --border: #dddfe6;
        --accent: #5b3fd1; --accent2: #0e8f6d; --text: #1a1d27;
        --muted: #5b6072; --code-bg: #f6f6f8; --inline-bg: #eef0f5;
        --heading: #101218;
      }
      #md-toolbar, #md-editor-wrap, #md-drop-overlay { display: none !important; }
      #md-workspace, #md-workspace.editing { max-width: 100% !important; padding: 0 !important; }
      body { background: #fff !important; }
      pre, table, blockquote, img { break-inside: avoid; }
    }
  `;

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const katexCss = document.createElement("link");
    katexCss.rel  = "stylesheet";
    katexCss.href = LIB + "katex.min.css";
    document.head.appendChild(katexCss);
  }

  /* ─── Favicon: círculo morado, generado en runtime (sin archivo extra) ─── */
  function setFavicon() {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="28" fill="%237c6af7"/>' +
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
     2. FUENTE MARKDOWN INICIAL (embebida en el HTML, opcional)
  ══════════════════════════════════════════════════════ */
  function getEmbeddedMarkdown() {
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
      s.onload  = resolve;
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
    // Grupos nombrados (t0, t1, ...) en vez de índices posicionales: así no
    // importa si el patrón de una regla trae sus propios grupos internos.
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
  ══════════════════════════════════════════════════════ */
  function renderMarkdown(raw) {
    const stash = [];

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
      // Compatibilidad con dos firmas de marked:
      //  - v5+: code(token) donde token = { text, lang, ... }
      //  - v4-: code(code, infostring, escaped) con "code" como string
      let text, lang;
      if (token !== null && typeof token === "object") {
        text = token.text;
        lang = token.lang || "";
      } else {
        text = token;
        lang = infostring || "";
      }
      const highlighted = highlightCode(text, lang);
      const la = lang ? ' data-lang="' + lang.split(/\s+/)[0] + '"' : "";
      return "<pre" + la + "><code>" + highlighted + "</code></pre>\n";
    };

    marked.use({ renderer, gfm: true, breaks: false });

    let html = marked.parse(safe);
    html = html.replace(/\x00LATEX_(\d+)\x00/g, (_, i) => stash[+i].src);
    return html;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ─── Resaltado del editor: títulos, separadores, LaTeX, énfasis y bloques de código ─── */
  function highlightMarkdown(raw) {
    const stash = [];
    const stashIt = (cls) => (m) => {
      stash.push({ cls, text: m });
      return "\x01STASH" + (stash.length - 1) + "\x01";
    };

    function restore(str) {
      return str.replace(/\x01STASH(\d+)\x01|([^\x01]+)/g, (m, idx, literal) => {
        if (idx !== undefined) {
          const item = stash[+idx];
          return `<span class="${item.cls}">${escapeHtml(item.text)}</span>`;
        }
        return escapeHtml(literal);
      });
    }

    function highlightInlineLine(line) {
      let text = line;
      // Orden importa: bloques $$...$$ antes que $...$, y **negrita** antes que *cursiva*
      text = text.replace(/\$\$([\s\S]*?)\$\$/g, stashIt("hl-math"));
      text = text.replace(/\$([^\n$]+?)\$/g, stashIt("hl-math"));
      text = text.replace(/\*\*([^\n*]+?)\*\*/g, stashIt("hl-bold"));
      text = text.replace(/\*([^\s*][^\n*]*?)\*/g, stashIt("hl-italic"));
      return text;
    }

    const rawLines = raw.split("\n");
    const outLines = [];
    let fenceLang = null; // null = fuera de un bloque de código; "" o "lang" = dentro

    for (const line of rawLines) {
      if (fenceLang !== null) {
        const fenceEnd = line.match(/^ {0,3}```\s*$/);
        if (fenceEnd) {
          outLines.push(`<span class="hl-fence">${escapeHtml(line)}</span>`);
          fenceLang = null;
        } else {
          const grammar = (function () {
            const key = fenceLang.toLowerCase().trim();
            const resolved = LANG_ALIASES[key] || key;
            return GRAMMARS[resolved === "clike_cpp" ? "cpp" : resolved];
          })();
          outLines.push(grammar ? tokenizeCode(line, grammar) : escapeHtml(line));
        }
        continue;
      }

      const fenceStart = line.match(/^ {0,3}```([\w+-]*)\s*$/);
      if (fenceStart) {
        outLines.push(`<span class="hl-fence">${escapeHtml(line)}</span>`);
        fenceLang = fenceStart[1] || "";
        continue;
      }

      const inlined = highlightInlineLine(line);

      const heading = inlined.match(/^ {0,3}(#{1,6})(\s.*)?$/);
      if (heading) {
        outLines.push(`<span class="hl-h${heading[1].length}">${restore(inlined)}</span>`);
        continue;
      }

      const hr = inlined.match(/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/);
      if (hr) {
        outLines.push(`<span class="hl-hr">${restore(inlined)}</span>`);
        continue;
      }

      outLines.push(restore(inlined));
    }

    return outLines.join("\n");
  }

  /* ══════════════════════════════════════════════════════
     5. ESTADO + UI
  ══════════════════════════════════════════════════════ */
  let workspaceEl, contentEl, editorWrapEl, editorEl, highlightEl, linenumbersEl;
  let filenameEl, fileInputEl, dropOverlayEl;
  let openBtn, toggleBtn, saveBtn, exportBtn, modeBtn;

  let currentRaw = "";
  let currentFilename = null;
  let mode = "view";      // "view" | "edit"
  let savedRaw = "";       // último contenido guardado o cargado

  function buildLayout() {
    document.body.innerHTML = "";
    document.documentElement.setAttribute("data-theme", "dark");

    const toolbar = document.createElement("div");
    toolbar.id = "md-toolbar";
    toolbar.innerHTML = `
      <div class="md-toolbar-group md-toolbar-left">
        <button id="md-open-btn" class="md-btn" type="button">Open.md</button>
        <button id="md-toggle-btn" class="md-btn" type="button" disabled>Edit</button>
      </div>
      <span class="md-filename" id="md-filename"></span>
      <div class="md-toolbar-group md-toolbar-right">
        <button id="md-save-btn" class="md-btn" type="button" disabled>Save</button>
        <button id="md-export-btn" class="md-btn" type="button" disabled>PDF</button>
        <button id="md-mode-btn" class="md-btn" type="button">Light</button>
      </div>
      <input type="file" id="md-file-input" accept=".md,.markdown,.mdown,.mkd,text/markdown,text/plain" />
    `;
    document.body.appendChild(toolbar);

    workspaceEl = document.createElement("div");
    workspaceEl.id = "md-workspace";
    document.body.appendChild(workspaceEl);

    contentEl = document.createElement("div");
    contentEl.id = "md-content";
    workspaceEl.appendChild(contentEl);

    editorWrapEl = document.createElement("div");
    editorWrapEl.id = "md-editor-wrap";
    editorWrapEl.innerHTML = `
      <div id="md-linenumbers" aria-hidden="true"></div>
      <pre id="md-highlight" class="md-editor-layer" aria-hidden="true"></pre>
      <textarea id="md-editor" class="md-editor-layer" spellcheck="false" placeholder="Escribí tu markdown acá..."></textarea>
    `;
    workspaceEl.appendChild(editorWrapEl);
    editorEl = editorWrapEl.querySelector("#md-editor");
    highlightEl = editorWrapEl.querySelector("#md-highlight");
    linenumbersEl = editorWrapEl.querySelector("#md-linenumbers");

    const overlay = document.createElement("div");
    overlay.id = "md-drop-overlay";
    overlay.innerHTML = `<span>⬇️ Soltá el archivo .md para abrirlo</span>`;
    document.body.appendChild(overlay);
    dropOverlayEl = overlay;

    filenameEl = document.getElementById("md-filename");
    fileInputEl = document.getElementById("md-file-input");
    openBtn = document.getElementById("md-open-btn");
    toggleBtn = document.getElementById("md-toggle-btn");
    saveBtn = document.getElementById("md-save-btn");
    exportBtn = document.getElementById("md-export-btn");
    modeBtn = document.getElementById("md-mode-btn");

    openBtn.addEventListener("click", () => fileInputEl.click());
    fileInputEl.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) openFile(file);
      fileInputEl.value = "";
    });

    toggleBtn.addEventListener("click", toggleMode);
    saveBtn.addEventListener("click", saveCurrentFile);
    exportBtn.addEventListener("click", exportPdf);
    modeBtn.addEventListener("click", toggleTheme);

    editorEl.addEventListener("input", () => {
      currentRaw = editorEl.value;
      updateHighlight();
      updateFilenameLabel();
    });
    editorEl.addEventListener("scroll", syncEditorScroll);
    editorEl.addEventListener("click", updateLineNumbers);
    editorEl.addEventListener("keyup", updateLineNumbers);

    setupDragAndDrop();
  }

  function setupDragAndDrop() {
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter++;
      dropOverlayEl.classList.add("active");
    });
    window.addEventListener("dragover", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    });
    window.addEventListener("dragleave", (e) => {
      if (!hasFiles(e)) return;
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) dropOverlayEl.classList.remove("active");
    });
    window.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter = 0;
      dropOverlayEl.classList.remove("active");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) openFile(file);
    });

    function hasFiles(e) {
      return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
    }
  }

  function openFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      loadDocument(String(reader.result), file.name);
    };
    reader.onerror = () => {
      contentEl.innerHTML = `<div class="md-empty"><div class="md-empty-icon">⚠️</div><h2>No se pudo leer el archivo</h2><p>${escapeHtml(String(reader.error))}</p></div>`;
    };
    reader.readAsText(file, "UTF-8");
  }

  function showEmpty() {
    contentEl.innerHTML = `
      <div class="md-empty">
        <div class="md-empty-icon">📄</div>
        <h2>Ningún documento cargado</h2>
        <p>Hacé clic en <strong>«Open»</strong> arriba, arrastrá y soltá un archivo Markdown, o hacé clic en <strong>«Edit»</strong> para empezar uno nuevo desde cero.</p>
      </div>`;
    filenameEl.innerHTML = "";
    document.title = DEFAULT_TITLE;
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
          console.warn("[md-render] KaTeX no disponible, LaTeX no se renderizará.", e);
        });
    }
    return katexReadyPromise;
  }

  async function renderPreview() {
    if (!currentRaw.trim()) {
      showEmpty();
      return;
    }
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
     7. CARGA DE DOCUMENTO (embebido o abierto por el usuario)
  ══════════════════════════════════════════════════════ */
  async function loadDocument(raw, filename) {
    currentRaw = raw;
    currentFilename = filename;
    savedRaw = raw;
    mode = "view";
    updateWorkspaceClass();
    updateFilenameLabel();
    toggleBtn.disabled = false;
    saveBtn.disabled = false;
    exportBtn.disabled = false;
    toggleBtn.textContent = "Edit";
    await renderPreview();
  }

  /* ══════════════════════════════════════════════════════
     8. TOGGLE VISTA / EDICIÓN
  ══════════════════════════════════════════════════════ */
  async function switchToEdit() {
    if (!currentFilename && !currentRaw.trim()) {
      currentFilename = "document.md";
      savedRaw = "";
    }
    mode = "edit";
    editorEl.value = currentRaw;
    updateHighlight();
    updateWorkspaceClass();
    toggleBtn.textContent = "View";
    saveBtn.disabled = false;
    exportBtn.disabled = false;
    updateFilenameLabel();
    editorEl.focus();
  }

  async function switchToView() {
    currentRaw = editorEl.value;
    mode = "view";
    updateWorkspaceClass();
    toggleBtn.textContent = "Edit";
    updateFilenameLabel();
    await renderPreview();
  }

  async function toggleMode() {
    if (mode === "view") await switchToEdit();
    else await switchToView();
  }

  function updateWorkspaceClass() {
    workspaceEl.classList.toggle("editing", mode === "edit");
  }

  function updateHighlight() {
    highlightEl.innerHTML = highlightMarkdown(editorEl.value) + "\n";
    updateLineNumbers();
    syncEditorScroll();
  }

  function syncEditorScroll() {
    highlightEl.scrollTop = editorEl.scrollTop;
    highlightEl.scrollLeft = editorEl.scrollLeft;
    linenumbersEl.scrollTop = editorEl.scrollTop;
  }

  function updateLineNumbers() {
    const count = (editorEl.value.match(/\n/g) || []).length + 1;
    const curLine = (editorEl.value.slice(0, editorEl.selectionStart || 0).match(/\n/g) || []).length;

    let html = "";
    for (let i = 0; i < count; i++) {
      html += i === curLine ? '<span class="ln-active">' + (i + 1) + "</span>" : String(i + 1);
      if (i < count - 1) html += "\n";
    }
    linenumbersEl.innerHTML = html;

    const digits = String(count).length;
    const gutterWidth = Math.max(2.4, digits * 0.62 + 1.8) + "em";
    linenumbersEl.style.width = gutterWidth;
    highlightEl.style.left = gutterWidth;
    editorEl.style.left = gutterWidth;
  }

  function updateFilenameLabel() {
    if (!currentFilename) {
      filenameEl.innerHTML = "";
      return;
    }
    const dirty = currentRaw !== savedRaw;
    filenameEl.innerHTML =
      `File: <strong class="${dirty ? "md-name-dirty" : ""}">${escapeHtml(currentFilename)}</strong>`;
    document.title = (dirty ? "● " : "") + currentFilename + " — " + DEFAULT_TITLE;
  }

  /* ══════════════════════════════════════════════════════
     9. GUARDAR (descarga el .md actual)
  ══════════════════════════════════════════════════════ */
  function saveCurrentFile() {
    if (mode === "edit") currentRaw = editorEl.value;

    const filename = currentFilename || "document.md";
    const blob = new Blob([currentRaw], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    savedRaw = currentRaw;
    currentFilename = filename;
    updateFilenameLabel();
  }

  /* ══════════════════════════════════════════════════════
     10. EXPORTAR A PDF (impresión nativa, siempre en tonos claros)
  ══════════════════════════════════════════════════════ */
  async function exportPdf() {
    if (mode === "edit") await switchToView();
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));
    window.print();
  }

  /* ══════════════════════════════════════════════════════
     11. TEMA OSCURO / CLARO
  ══════════════════════════════════════════════════════ */
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    modeBtn.textContent = next === "dark" ? "Light" : "Dark";
  }

  /* ══════════════════════════════════════════════════════
     12. MAIN
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

    const embedded = getEmbeddedMarkdown();
    if (embedded && embedded.trim()) {
      await loadDocument(embedded, null);
    } else {
      showEmpty();
      toggleBtn.disabled = false; // permite empezar un doc nuevo desde cero
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
