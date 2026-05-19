import { useState } from "react";
import { pdfFileToDocumentPacket } from "../lib/pdf-document-packet";
import { DOCUMENT_PACKET_SAMPLE_TEXT } from "../samples/documentPacketSample";
import { SAVE_ACT_SAMPLE_TEXT } from "../samples/saveActSample";

const CONTENT_TYPES = ["text", "html", "xml", "json"] as const;
const STATE_OPTIONS = [
  ["", "I don't know"],
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

interface AnalyzeFormProps {
  onSubmit: (
    content: string,
    contentType: string,
    options: Record<string, boolean>,
    userSelectedState: string | null,
  ) => void;
  loading: boolean;
}

export function AnalyzeForm({ onSubmit, loading }: AnalyzeFormProps) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<string>("text");
  const [userSelectedState, setUserSelectedState] = useState("");
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadDocumentSample = () => {
    setContent(DOCUMENT_PACKET_SAMPLE_TEXT);
    setContentType("json");
    setPdfStatus(null);
    setPdfError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      content,
      contentType,
      {
        run_meaning: true,
        run_origin: true,
        run_verification: true,
      },
      userSelectedState || null,
    );
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
              Add a document
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Paste text, upload a text-based PDF, or try the document sample. The original source
              text will stay visible in the navigator.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDocumentSample}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Try document sample
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="block text-xs font-medium text-muted-foreground">
          Jurisdiction context
          <select
            value={userSelectedState}
            onChange={(event) => setUserSelectedState(event.target.value)}
            disabled={loading}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {STATE_OPTIONS.map(([value, label]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Format
          </span>
          <div className="flex gap-0.5 rounded-md bg-surface-raised p-0.5">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => setContentType(ct)}
                className={`flex-1 rounded px-2 py-1.5 text-[11px] font-mono transition-colors ${
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
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste document text here..."
        className="w-full rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-6 text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        rows={8}
      />

      <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="rounded-md border border-border bg-surface-raised px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {loading ? "Opening navigator..." : "Open navigator"}
        </button>
        <details className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">
            Diagnostic/dev samples
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setContent(SAVE_ACT_SAMPLE_TEXT);
                setContentType("text");
                setPdfStatus(null);
                setPdfError(null);
              }}
              className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Load legacy text sample
            </button>
            <button
              type="button"
              onClick={loadDocumentSample}
              className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Load packet JSON sample
            </button>
          </div>
        </details>
      </div>
    </form>
  );
}
