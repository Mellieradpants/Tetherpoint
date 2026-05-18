import { useState } from "react";
import { pdfFileToDocumentPacket } from "../lib/pdf-document-packet";
import { DOCUMENT_PACKET_SAMPLE_TEXT } from "../samples/documentPacketSample";
import { SAVE_ACT_SAMPLE_TEXT } from "../samples/saveActSample";

const CONTENT_TYPES = ["text", "html", "xml", "json"] as const;

interface AnalyzeFormProps {
  onSubmit: (content: string, contentType: string, options: Record<string, boolean>) => void;
  loading: boolean;
}

export function AnalyzeForm({ onSubmit, loading }: AnalyzeFormProps) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<string>("text");
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(content, contentType, {
      run_meaning: true,
      run_origin: true,
      run_verification: true,
    });
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfStatus(`Extracting text from ${file.name}...`);
    setPdfError(null);

    try {
      const packet = await pdfFileToDocumentPacket(file);
      setContent(JSON.stringify(packet, null, 2));
      setContentType("json");
      setPdfStatus(
        `PDF packet ready: ${packet.pages.length} page${packet.pages.length === 1 ? "" : "s"} extracted from ${file.name}.`,
      );
    } catch (error) {
      setPdfStatus(null);
      setPdfError(error instanceof Error ? error.message : "Could not extract text from this PDF.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Type
        </span>
        <div className="flex gap-0.5 rounded-md bg-surface p-0.5">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => setContentType(ct)}
              className={`rounded px-3 py-1 text-[11px] font-mono transition-colors ${
                contentType === ct
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ct}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste document content here…"
        className="w-full rounded-md border border-border bg-surface p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        rows={6}
      />

      <div className="rounded-md border border-border bg-surface/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="rounded-md bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent">
            Upload PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              disabled={loading}
              className="sr-only"
            />
          </label>
          <div className="text-xs leading-5 text-muted-foreground">
            Text-based PDFs only. Layout reconstruction is basic; tables, columns, headers, footers,
            and footnotes may have imperfect reading order. Long PDFs may exceed the existing API
            character limit.
          </div>
        </div>
        {pdfStatus && <div className="mt-2 text-xs text-primary">{pdfStatus}</div>}
        {pdfError && <div className="mt-2 text-xs text-destructive">{pdfError}</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
        <button
          type="button"
          onClick={() => {
            setContent(SAVE_ACT_SAMPLE_TEXT);
            setContentType("text");
            setPdfStatus(null);
            setPdfError(null);
          }}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
        >
          Load Sample
        </button>
        <button
          type="button"
          onClick={() => {
            setContent(DOCUMENT_PACKET_SAMPLE_TEXT);
            setContentType("json");
            setPdfStatus(null);
            setPdfError(null);
          }}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
        >
          Load Packet Sample
        </button>
      </div>
    </form>
  );
}
