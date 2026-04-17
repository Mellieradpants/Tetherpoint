import { useState } from "react";
import { AnalyzeRequest } from "../types";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Federal Energy Commission Report</title>
  <meta name="author" content="Sarah Chen">
  <meta property="og:title" content="FERC Grid Standards 2025">
</head>
<body>
  <p>The Federal Energy Regulatory Commission enacted Order No. 2222-A on November 1, 2024.</p>
  <p>Tesla Inc. reported Q3 2024 revenue of $25.2 billion.</p>
  <p>The Supreme Court ruled in West Virginia v. EPA.</p>
</body>
</html>`;

const CONTENT_TYPES = ["text", "html", "xml", "json"] as const;

interface InputFormProps {
  onSubmit: (request: AnalyzeRequest) => void;
  loading: boolean;
}

export function InputForm({ onSubmit, loading }: InputFormProps) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<
    "xml" | "html" | "json" | "text"
  >("text");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      content,
      content_type: contentType,
      options: {
        run_meaning: true,
        run_origin: true,
        run_verification: true,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <div className="form-group">
        <div className="type-row">
          <span className="type-label">Type</span>
          <div className="type-pills">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={contentType === type ? "type-pill active" : "type-pill"}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Paste document content here..."
          required
        />
      </div>

      <div className="button-row">
        <button type="submit" disabled={loading || !content.trim()}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setContent(SAMPLE_HTML);
            setContentType("html");
          }}
        >
          Load Sample
        </button>
      </div>
    </form>
  );
}
