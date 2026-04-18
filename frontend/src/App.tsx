import { useState } from "react";
import "./App.css";
import { InputForm } from "./components/InputForm";
import { ResultsView } from "./components/ResultsView";
import type { AnalyzeRequest, PipelineResponse } from "./types";
import { analyzeDocumentRequest } from "./api/client";

function App() {
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(true);

  const handleSubmit = async (request: AnalyzeRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeDocumentRequest(request);
      setResult(data);
      setShowInput(false);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <header>
        <div>
          <h1>Anchored Flow Stack</h1>
          <p className="subtitle">Source-Anchored Parsing Stack</p>
        </div>

        {result && (
          <button type="button" onClick={() => setShowInput((value) => !value)}>
            {showInput ? "Hide Input" : "New Analysis"}
          </button>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      {showInput && <InputForm onSubmit={handleSubmit} loading={loading} />}

      {loading && (
        <div className="layer-section">
          <h3>Pipeline Status</h3>
          <div className="layer-content">
            <p>Running analysis pipeline...</p>
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="layer-section">
          <h3>Ready</h3>
          <div className="layer-content">
            <p>Paste content and run the pipeline to inspect node-level results.</p>
          </div>
        </div>
      )}

      {result && <ResultsView data={result} />}
    </div>
  );
}

export default App;
