import { useState, useCallback, useRef, useEffect } from "react";
import { FileUp, Upload, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Ansprechpartner {
  Vorname: string;
  Name: string;
  Firma: string;
  Strasse: string;
  PLZ: string;
  Ort: string;
  Telnr: string;
  Email: string;
}

interface UploadScreenProps {
  onHtmlLoaded: (html: string) => void;
  webhookUrl: string;
  onOpenHtmlFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ANSPRECHPARTNER_URL =
  "https://valentum-engineering.app.n8n.cloud/webhook/get_ansprechpartner";

const UploadScreen = ({ onHtmlLoaded, webhookUrl, onOpenHtmlFile }: UploadScreenProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const [ansprechpartner, setAnsprechpartner] = useState<Ansprechpartner[]>([]);
  const [selectedAnsprechpartner, setSelectedAnsprechpartner] = useState<string>("");
  const [loadingAnsprechpartner, setLoadingAnsprechpartner] = useState(false);

  useEffect(() => {
    const fetchAnsprechpartner = async () => {
      setLoadingAnsprechpartner(true);
      try {
        const res = await fetch(ANSPRECHPARTNER_URL);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [data];
        setAnsprechpartner(list);
      } catch (err) {
        console.error("Failed to fetch Ansprechpartner:", err);
      } finally {
        setLoadingAnsprechpartner(false);
      }
    };
    fetchAnsprechpartner();
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Bitte lade eine PDF-Datei hoch.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(webhookUrl, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Fehler: ${response.status}`);
      const resultHtml = await response.text();
      onHtmlLoaded(resultHtml);
    } catch (err) {
      console.error("PDF processing failed:", err);
      setError("PDF-Verarbeitung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setIsProcessing(false);
    }
  }, [webhookUrl, onHtmlLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-4">
      <div className="w-full max-w-lg text-center space-y-8">
        {/* Logo / Title */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-4 inline-block shadow-sm border border-border">
            <img
              src="https://www.valentum.de/static/layout/valentum/site/valentum_engineering_logo.png"
              alt="Valentum Engineering"
              className="h-14"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Exposé Generator
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Lade einen Lebenslauf als PDF hoch – unsere KI extrahiert automatisch die relevanten Informationen und erstellt daraus ein standardisiertes Valentum-Exposé.
          </p>
        </div>

        {/* Ansprechpartner Dropdown */}
        <div className="w-full max-w-xs mx-auto">
          <label className="block text-sm font-medium text-foreground mb-2 text-left">
            Ansprechpartner
          </label>
          <Select
            value={selectedAnsprechpartner}
            onValueChange={setSelectedAnsprechpartner}
            disabled={loadingAnsprechpartner}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  loadingAnsprechpartner ? "Wird geladen…" : "Ansprechpartner wählen"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {ansprechpartner.map((ap, idx) => (
                <SelectItem key={idx} value={ap.Email}>
                  {ap.Vorname} {ap.Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && pdfInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 transition-all duration-200 ${
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-secondary/50"
          } ${isProcessing ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">PDF wird verarbeitet…</p>
                <p className="text-xs text-muted-foreground">Das kann einige Sekunden dauern</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <FileUp className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  PDF hier ablegen oder klicken
                </p>
                <p className="text-xs text-muted-foreground">
                  Unterstützt: PDF-Dateien
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {/* Alternative: open existing HTML */}
        <div className="pt-2">
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm"
            onChange={onOpenHtmlFile}
            className="hidden"
          />
          <button
            onClick={() => htmlInputRef.current?.click()}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Oder eine bestehende HTML-Datei öffnen
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;
