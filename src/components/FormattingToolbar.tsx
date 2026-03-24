import { Bold, Italic, Underline, Type, Image, Undo2, Redo2 } from "lucide-react";
import { useCallback, useRef } from "react";

interface FormattingToolbarProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

const FormattingToolbar = ({ iframeRef }: FormattingToolbarProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.execCommand(command, false, value);
  }, [iframeRef]);

  const handleFontSize = useCallback((size: string) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.execCommand("fontSize", false, size);
  }, [iframeRef]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== "string") return;

      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const slot = doc.querySelector('[data-slot="profile-image"]');
      if (!slot) return;

      // Read target dimensions from data attributes or slot CSS
      const targetW = parseInt(slot.getAttribute("data-width") || "120", 10);
      const targetH = parseInt(slot.getAttribute("data-height") || "160", 10);

      // Create an off-screen image to get natural dimensions
      const img = new window.Image();
      img.onload = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        // Fit image into slot while preserving aspect ratio
        const scale = Math.min(targetW / natW, targetH / natH);
        const finalW = Math.round(natW * scale);
        const finalH = Math.round(natH * scale);

        // Replace the placeholder div with an img element
        const imgEl = doc.createElement("img");
        imgEl.src = dataUrl;
        imgEl.alt = "Profilbild";
        imgEl.setAttribute("data-slot", "profile-image");
        imgEl.setAttribute("data-width", String(targetW));
        imgEl.setAttribute("data-height", String(targetH));
        imgEl.style.width = finalW + "px";
        imgEl.style.height = finalH + "px";
        imgEl.style.objectFit = "cover";
        imgEl.style.display = "block";
        imgEl.style.border = "none";
        imgEl.className = "profile-image-box";

        slot.replaceWith(imgEl);

        // Sync back to code editor
        iframeRef.current?.contentWindow?.postMessage({ type: "trigger-sync" }, "*");
        // Fallback: trigger input event
        doc.body.dispatchEvent(new Event("input", { bubbles: true }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [iframeRef]);

  const btnClass =
    "flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors";

  return (
    <div className="flex items-center gap-0.5 px-3 h-10 bg-card border-b border-border overflow-x-auto shrink-0">
      <button onClick={() => execCommand("undo")} className={btnClass} title="Rückgängig">
        <Undo2 className="w-4 h-4" />
      </button>
      <button onClick={() => execCommand("redo")} className={btnClass} title="Wiederholen">
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button onClick={() => execCommand("bold")} className={btnClass} title="Fett">
        <Bold className="w-4 h-4" />
      </button>
      <button onClick={() => execCommand("italic")} className={btnClass} title="Kursiv">
        <Italic className="w-4 h-4" />
      </button>
      <button onClick={() => execCommand("underline")} className={btnClass} title="Unterstrichen">
        <Underline className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Type className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          onChange={(e) => handleFontSize(e.target.value)}
          defaultValue="3"
          className="bg-secondary text-foreground text-xs rounded-md px-2 py-1 border border-border outline-none cursor-pointer"
        >
          <option value="1">Klein</option>
          <option value="2">Kleiner</option>
          <option value="3">Normal</option>
          <option value="4">Größer</option>
          <option value="5">Groß</option>
          <option value="6">Sehr groß</option>
          <option value="7">Riesig</option>
        </select>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <button
        onClick={() => imageInputRef.current?.click()}
        className={btnClass}
        title="Profilbild einfügen"
      >
        <Image className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FormattingToolbar;
