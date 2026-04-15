import * as React from "react";

export function HomePage() {
  const [content, setContent] = React.useState("");
  const [result, setResult] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleAnalyze() {
    if (!content.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        "https://anchored-flow-stack.onrender.com/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-analyze-secret": "Apple_Banana_Bridge!123",
          },
          body: JSON.stringify({
            content,
            content_type: "text",
            options: {
              run_meaning: true,
              run_origin: true,
              run_verification: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ error: "Failed to analyze" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginBottom: "20px" }}>Tetherpoint Analyzer</h1>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste text here..."
        style={{
          width: "100%",
          height: "150px",
          padding: "10px",
          fontSize: "14px",
          marginBottom: "20px",
        }}
      />

      <button
        type="button"
        onClick={handleAnalyze}
        style={{
          padding: "10px 20px",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {result !== null && (
        <pre
          style={{
            marginTop: "20px",
            background: "#111",
            color: "#0f0",
            padding: "15px",
            overflowX: "auto",
            fontSize: "12px",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}