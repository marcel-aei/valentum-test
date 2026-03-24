import { useState, useCallback, useRef, useEffect } from "react";
import { Code2, Eye, GripVertical, Download, PenLine, FileText, FileUp, Loader2, Upload, ArrowLeft } from "lucide-react";
import UploadScreen from "./UploadScreen";
import FormattingToolbar from "./FormattingToolbar";

const N8N_WEBHOOK_URL = "https://valentum-engineering.app.n8n.cloud/webhook/pdf-upload";

// Script injected into iframe to enable contentEditable and sync back
const EDITABLE_SCRIPT = `
<style data-editor-injected>
  tr { position: relative; }
  tr:hover { outline: 1px solid rgba(100, 160, 220, 0.4); }
  .profile-image-slot { contenteditable: false; }
  .profile-image-box { border: none !important; background: #f5f7fa; }
  [data-slot="profile-image"] { pointer-events: none; }
  .row-controls-cell {
    padding: 0 !important;
    border: none !important;
    width: 40px !important;
    min-width: 40px !important;
    text-align: center;
    vertical-align: middle;
  }
  .row-controls {
    display: flex;
    gap: 2px;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
  }
  tr:hover .row-controls { opacity: 1; }
  .row-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui;
    padding: 0;
    transition: background 0.15s;
  }
  .row-btn-add {
    background: rgba(100, 160, 220, 0.15);
    color: #64a0dc;
  }
  .row-btn-add:hover { background: rgba(100, 160, 220, 0.35); }
  .row-btn-del {
    background: rgba(150, 150, 160, 0.15);
    color: #8a8a96;
  }
  .row-btn-del:hover { background: rgba(150, 150, 160, 0.35); color: #c55; }
</style>
<script>
(function() {
  document.body.contentEditable = 'true';
  document.body.style.outline = 'none';
  var updating = false;

  // Make profile image slot non-editable
  var profileSlot = document.querySelector('.profile-image-slot');
  if (profileSlot) profileSlot.contentEditable = 'false';

  function syncBack() {
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('.row-controls-cell').forEach(function(el) { el.remove(); });
    clone.querySelectorAll('[data-editor-injected]').forEach(function(el) { el.remove(); });
    clone.querySelectorAll('script').forEach(function(el) {
      if (el.textContent && el.textContent.indexOf('preview-edit') !== -1) el.remove();
    });
    var html = '<!DOCTYPE html>\\n' + clone.outerHTML;
    window.parent.postMessage({ type: 'preview-edit', html: html }, '*');
  }

  var debounceTimer;
  document.body.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncBack, 150);
  });

  function addRowControls() {
    if (updating) return;
    updating = true;
    document.querySelectorAll('.row-controls-cell').forEach(function(el) { el.remove(); });

    document.querySelectorAll('table').forEach(function(table) {
      var rows = table.querySelectorAll('tr');
      rows.forEach(function(row) {
        var controlCell = document.createElement(row.querySelector('th') ? 'th' : 'td');
        controlCell.className = 'row-controls-cell';
        controlCell.contentEditable = 'false';

        var wrapper = document.createElement('div');
        wrapper.className = 'row-controls';

        var addBtn = document.createElement('button');
        addBtn.className = 'row-btn row-btn-add';
        addBtn.textContent = '+';
        addBtn.title = 'Add row below';
        addBtn.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var cells = row.querySelectorAll('td, th');
          var newRow = document.createElement('tr');
          var cellCount = 0;
          cells.forEach(function(c) { if (!c.classList.contains('row-controls-cell')) cellCount++; });
          for (var i = 0; i < cellCount; i++) {
            var td = document.createElement('td');
            td.innerHTML = '&nbsp;';
            newRow.appendChild(td);
          }
          row.parentNode.insertBefore(newRow, row.nextSibling);
          addRowControls();
          syncBack();
        });

        var delBtn = document.createElement('button');
        delBtn.className = 'row-btn row-btn-del';
        delBtn.textContent = '×';
        delBtn.title = 'Delete this row';
        delBtn.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (table.querySelectorAll('tr').length > 1) {
            row.remove();
            addRowControls();
            syncBack();
          }
        });

        wrapper.appendChild(addBtn);
        wrapper.appendChild(delBtn);
        controlCell.appendChild(wrapper);
        row.appendChild(controlCell);
      });
    });
    updating = false;
  }

  setTimeout(addRowControls, 100);
})();
<\/script>`;

function injectEditableScript(html: string): string {
  let cleaned = html
    .replace(/\n?<style data-editor-injected>[\s\S]*?<\/style>/g, '')
    .replace(/\n?<script>\n?\(function\(\)\s*\{[\s\S]*?preview-edit[\s\S]*?<\/script>/g, '')
    .replace(/\s*<(td|th) class="row-controls-cell"[^>]*>[\s\S]*?<\/(td|th)>/g, '');
  const bodyClose = cleaned.lastIndexOf('</body>');
  if (bodyClose !== -1) {
    return cleaned.slice(0, bodyClose) + EDITABLE_SCRIPT + '\n' + cleaned.slice(bodyClose);
  }
  return cleaned + EDITABLE_SCRIPT;
}

function stripEditableScript(html: string): string {
  return html
    .replace(/\n?<style data-editor-injected>[\s\S]*?<\/style>/g, '')
    .replace(/\n?<script>\n?\(function\(\)\s*\{[\s\S]*?preview-edit[\s\S]*?<\/script>/g, '')
    .replace(/\s*<(td|th) class="row-controls-cell"[^>]*>[\s\S]*?<\/(td|th)>/g, '');
}

const HtmlEditor = () => {
  const [html, setHtml] = useState("");
  const [hasContent, setHasContent] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const editSourceRef = useRef<"code" | "preview">("code");

  // Enter editor mode with HTML content
  const handleHtmlLoaded = useCallback((newHtml: string) => {
    editSourceRef.current = "code";
    setHtml(newHtml);
    setHasContent(true);
  }, []);

  const handleOpenHtmlFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") handleHtmlLoaded(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [handleHtmlLoaded]);

  // Drag handle for code/preview split
  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.min(80, Math.max(20, pct)));
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // Listen for postMessage from iframe (preview edits)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'preview-edit' && typeof e.data.html === 'string') {
        editSourceRef.current = "preview";
        setHtml(stripEditableScript(e.data.html));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // iframe srcDoc management
  const srcDoc = injectEditableScript(html);
  const [iframeSrcDoc, setIframeSrcDoc] = useState(srcDoc);

  useEffect(() => {
    if (editSourceRef.current === "preview") {
      editSourceRef.current = "code";
    } else {
      setIframeSrcDoc(injectEditableScript(html));
    }
  }, [html]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    editSourceRef.current = "code";
    setHtml(e.target.value);
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lebenslauf.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [html]);

  const handleExportPdf = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onafterprint = () => printWindow.close();
    setTimeout(() => printWindow.print(), 300);
  }, [html]);

  const handleReuploadPdf = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsReprocessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(N8N_WEBHOOK_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Fehler: ${response.status}`);
      const resultHtml = await response.text();
      editSourceRef.current = "code";
      setHtml(resultHtml);
    } catch (err) {
      console.error("PDF processing failed:", err);
      alert("PDF-Verarbeitung fehlgeschlagen.");
    } finally {
      setIsReprocessing(false);
    }
  }, []);

  const lineCount = html.split("\n").length;

  // Upload screen
  if (!hasContent) {
    return (
      <UploadScreen
        onHtmlLoaded={handleHtmlLoaded}
        webhookUrl={N8N_WEBHOOK_URL}
        onOpenHtmlFile={handleOpenHtmlFile}
      />
    );
  }

  // Editor screen
  return (
    <div className="flex flex-col h-screen bg-background select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHasContent(false)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Zurück zum Upload"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
           <span className="font-semibold text-sm tracking-tight">
             Exposé Editor
           </span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            onChange={handleReuploadPdf}
            className="hidden"
          />
          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={isReprocessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {isReprocessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            {isReprocessing ? "Verarbeite…" : "Neues PDF"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            HTML
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF Export
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showCode
                ? "text-accent bg-accent/10 hover:bg-accent/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code
          </button>
        </div>
      </header>

      {/* Formatting Toolbar */}
      <FormattingToolbar iframeRef={iframeRef} />

      {/* Editor + Preview */}
      <div ref={containerRef} className="flex flex-1 min-h-0 relative">
        {/* Code Panel (toggleable) */}
        {showCode && (
          <>
            <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: `${splitPos}%` }}>
              <div className="flex items-center gap-2 px-4 h-9 bg-editor-bg border-b shrink-0">
                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">HTML</span>
                <span className="text-xs text-editor-gutter ml-auto">{lineCount} lines</span>
              </div>
              <div className="relative flex-1 min-h-0 bg-editor-bg overflow-auto" ref={editorScrollRef}>
                <div className="flex min-h-full">
                  <div className="flex flex-col pt-3 pb-3 px-3 text-right select-none shrink-0 bg-editor-bg border-r border-editor-line sticky left-0 z-10">
                    {Array.from({ length: lineCount }, (_, i) => (
                      <span key={i} className="text-xs leading-[1.65rem] text-editor-gutter font-mono">
                        {i + 1}
                      </span>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={html}
                    onChange={handleCodeChange}
                    spellCheck={false}
                    className="flex-1 bg-transparent text-foreground font-mono text-sm leading-[1.65rem] p-3 resize-none outline-none min-w-0 select-text overflow-hidden"
                    style={{ tabSize: 2, height: `${lineCount * 1.65}rem` }}
                  />
                </div>
              </div>
            </div>

            {/* Drag Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={`w-1 flex items-center justify-center cursor-col-resize shrink-0 group transition-colors z-10 ${
                isDragging ? "bg-primary" : "bg-border hover:bg-primary/50"
              }`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        )}

        {/* Preview Panel */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: showCode ? `${100 - splitPos}%` : "100%" }}>
          <div className="flex items-center gap-2 px-4 h-9 bg-secondary border-b shrink-0">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Vorschau</span>
            <span className="text-xs text-primary ml-1">• bearbeitbar</span>
          </div>
          <div className="flex-1 min-h-0 bg-preview-bg">
            <iframe
              ref={iframeRef}
              srcDoc={iframeSrcDoc}
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {isDragging && <div className="absolute inset-0 z-20 cursor-col-resize" />}
      </div>
    </div>
  );
};

export default HtmlEditor;
