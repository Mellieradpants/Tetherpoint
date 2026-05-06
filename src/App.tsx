import { useState } from "react";
import { AnalyzeForm } from "./components/AnalyzeForm";
import { ReceiptWorkspace, type PipelineResponse } from "./components/ReceiptWorkspace";
import { analyzeDocument } from "./lib/api-client";

function HowToUse({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-muted">
              Source-backed analysis
            </div>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Tetherpoint turns source text into a traceable result you can inspect.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Paste a document, run the analysis, then review the four result views: plain meaning, origin, verification, and governance. Each view focuses on what is backed by the submitted source and what still needs review.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="mt-7 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start using Tetherpoint
            </button>
          </section>

          <section className="rounded-xl border border-border/60 bg-surface p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
              How to use this tool
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-semibold text-foreground">1. Paste source content</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Use text, HTML, XML, or JSON from the document you want reviewed.
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">2. Run the analysis</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Tetherpoint parses the source, groups supported rule units, and runs meaning, origin, verification, and governance checks.
                </p>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">3. Review the backed result</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Read the plain meaning first, then use the other tabs to see source identity, verification routes, and governance review status.
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
    options: Record<string, boolean>
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
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-primary tracking-tight">Tetherpoint</h1>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:inline">
            Source-Backed Analysis
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
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              New Analysis
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={() => setShowInput((value) => !value)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showInput ? "Hide Input" : "Show Input"}
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
              className={`border-b border-border bg-surface/50 ${
                result ? "max-h-[40vh] overflow-y-auto" : ""
              }`}
            >
              <div className="mx-auto max-w-3xl px-4 py-4">
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
          ) : !loading && (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="max-w-md text-center">
                <div className="text-lg font-semibold text-primary mb-1">Ready for source text</div>
                <div className="text-xs leading-6 text-muted-foreground">
                  Paste content above and run the analysis to review plain meaning, origin, verification, and governance.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
