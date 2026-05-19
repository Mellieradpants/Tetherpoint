import { useState } from "react";
import { AnalyzeForm } from "./components/AnalyzeForm";
import { ReceiptWorkspace } from "./components/ReceiptWorkspace";
import { analyzeDocument } from "./lib/api-client";
import type { PipelineResponse } from "./types/pipeline";

function HowToUse({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <section className="max-w-3xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-primary">
              Tetherpoint Document Navigator
            </div>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Read the document first. See helpful context beside the part you select.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Upload or paste a document. Tetherpoint keeps the source text visible, maps the
              document into sections, and shows helpful information beside the part you select.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              It helps you see what a section says, what it may depend on, what source support is
              attached, and what still needs review.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="mt-7 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Open navigator
            </button>
          </section>

          <section className="rounded-lg border border-border/70 bg-surface p-5 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
              How it works
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-semibold text-foreground">1. Add a document</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Paste text, load the document sample, or upload a text-based PDF.
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">2. Select a section</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The document stays in the center so you can move through pages and passages.
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">3. Review attached help</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The side panel shows meaning, source support, references, jurisdiction, status,
                  and review notes when they are available.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function App() {
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);

  const handleSubmit = async (
    content: string,
    contentType: string,
    options: Record<string, boolean>,
    userSelectedState: string | null,
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeDocument({
        content,
        content_type: contentType,
        options: {
          run_meaning: Boolean(options.run_meaning),
          run_origin: Boolean(options.run_origin),
          run_verification: Boolean(options.run_verification),
        },
        user_selected_state: userSelectedState,
      });

      setResult(data as PipelineResponse);
      setShowInput(false);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const startNewAnalysis = () => {
    setStarted(true);
    setShowInput(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background md:h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-primary tracking-tight">Tetherpoint</h1>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:inline">
            Document Navigator
          </span>
        </div>
        <div className="flex items-center gap-3">
          {started && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError(null);
                setShowInput(true);
              }}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              New document
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={() => setShowInput((value) => !value)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showInput ? "Hide document input" : "Show document input"}
            </button>
          )}
        </div>
      </header>

      {!started ? (
        <HowToUse onStart={startNewAnalysis} />
      ) : (
        <>
          {showInput && (
            <div
              className={`border-b border-border bg-surface/80 ${
                result ? "max-h-[40vh] overflow-y-auto" : ""
              }`}
            >
              <div className="mx-auto max-w-4xl px-4 py-4">
                <AnalyzeForm onSubmit={handleSubmit} loading={loading} />
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result ? (
            <div className="flex-1 md:overflow-hidden">
              <div className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1">
                  <ReceiptWorkspace data={result} />
                </div>
              </div>
            </div>
          ) : (
            !loading && (
              <div className="flex-1 flex items-center justify-center px-4">
                <div className="max-w-md text-center">
                  <div className="text-lg font-semibold text-primary mb-1">
                    Ready for a document
                  </div>
                  <div className="text-xs leading-6 text-muted-foreground">
                    Paste text, load the document sample, or upload a PDF to open the navigator.
                  </div>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

export default App;
