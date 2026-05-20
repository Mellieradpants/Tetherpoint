import { useEffect, useState, type ReactNode } from "react";
import { translatePlainMeaning } from "../../lib/api-client";
import { ANSWER_LANGUAGE_OPTIONS } from "./answer-language";
import type { DocSection, VerificationStatus } from "./meaning-navigator-model";

type StatusStyle = { label: string; color: string; bg: string; dot: string };

const STATUS_CONFIG: Record<VerificationStatus, StatusStyle> = {
  verified: { label: "Verified", color: "#2d6a4f", bg: "#d8f3dc", dot: "#52b788" },
  partial: { label: "Partial", color: "#7b4b00", bg: "#fff3cd", dot: "#f4a261" },
  unverified: { label: "Unverified", color: "#6b1c1c", bg: "#fde8e8", dot: "#e63946" },
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}>
      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginLeft: 3, opacity: 0.6, display: "inline" }}>
      <path d="M2 9L9 2M9 2H5M9 2V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

function CollapsiblePanel({ title, accent, children, defaultOpen = false }: { title: string; accent: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: `2px solid ${accent}25`, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "11px 0 9px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", minHeight: 44 }}
      >
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && <div style={{ paddingBottom: 14, animation: "fadeIn 0.18s ease" }}>{children}</div>}
    </div>
  );
}

function MetaRow({ label, value, url }: { label: string; value: string; url?: string | null }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8a7f72", minWidth: 72, paddingTop: 2, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#3d3530", lineHeight: 1.55, flex: 1 }}>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#5c4a3a", textDecoration: "underline", textDecorationStyle: "dotted" }}>
            {value}<ExternalIcon />
          </a>
        ) : value}
      </span>
    </div>
  );
}

function languageLabel(language: string) {
  return ANSWER_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || "English";
}

function MeaningContent({ active, onClose, isMobile, answerLanguage }: { active: DocSection; onClose: () => void; isMobile: boolean; answerLanguage: string }) {
  const [translatedMeaning, setTranslatedMeaning] = useState("");
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let alive = true;
    setTranslatedMeaning("");
    setTranslationState("idle");

    if (answerLanguage === "en" || !active.meaning.trim()) return;

    setTranslationState("loading");
    translatePlainMeaning({ text: active.meaning, language: answerLanguage })
      .then((result) => {
        if (!alive) return;
        setTranslatedMeaning(result.translated_text);
        setTranslationState("idle");
      })
      .catch(() => {
        if (!alive) return;
        setTranslationState("error");
      });

    return () => { alive = false; };
  }, [active.id, active.meaning, answerLanguage]);

  const status = STATUS_CONFIG[active.verification.status];
  const visibleMeaning = translatedMeaning || active.meaning;

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 8, border: "1.5px solid #e8c99a", padding: isMobile ? "18px 18px" : "20px 22px", marginBottom: 8, boxShadow: "0 2px 14px rgba(193,127,58,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c17f3a" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#c17f3a", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Plain Meaning</span>
        </div>
        <p style={{ fontSize: isMobile ? 16 : 16.5, lineHeight: 1.8, color: "#2a1f1a", fontWeight: 400 }}>
          {translationState === "loading" ? "Translating..." : visibleMeaning}
        </p>
        {translationState === "error" && <p style={{ marginTop: 8, fontSize: 12, color: "#7b4b00", fontFamily: "'IBM Plex Mono', monospace" }}>Translation unavailable. Showing original meaning.</p>}
        {answerLanguage !== "en" && translationState !== "error" && <p style={{ marginTop: 8, fontSize: 11, color: "#a09080", fontFamily: "'IBM Plex Mono', monospace" }}>Language: {languageLabel(answerLanguage)}</p>}
      </div>

      <div style={{ padding: "14px 2px 2px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: "#b0a595", letterSpacing: "0.1em", textTransform: "uppercase" }}>Traceability Stack</div>

      <CollapsiblePanel title="Origin" accent="#4a6fa5" defaultOpen={true}>
        <MetaRow label="Source" value={active.origin.source} url={active.origin.url} />
        <MetaRow label="Anchor" value={active.origin.statute} />
      </CollapsiblePanel>

      <CollapsiblePanel title="Verification" accent="#2d6a4f">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: status.bg, borderRadius: 4, padding: "3px 9px", marginBottom: 10 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: status.dot }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: status.color, fontWeight: 600, letterSpacing: "0.06em" }}>{status.label}</span>
        </div>
        <MetaRow label="Cross-ref" value={active.verification.crossRef} />
        <MetaRow label="Note" value={active.verification.note} />
      </CollapsiblePanel>

      <CollapsiblePanel title="Governance" accent="#6b3fa0">
        <MetaRow label="Status" value={active.governance.procedural} />
        <MetaRow label="Safeguard" value={active.governance.safeguards} />
        {active.governance.flags.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#a09080", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Flags</div>
            {active.governance.flags.map((flag, index) => (
              <div key={`${flag}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                <span style={{ color: "#e67e22", fontSize: 11, paddingTop: 1, flexShrink: 0 }}>⚑</span>
                <span style={{ fontSize: 13, color: "#5a4535", lineHeight: 1.5 }}>{flag}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: "#52b788" }}>✓</span>
            <span style={{ fontSize: 12, color: "#52b788", fontFamily: "'IBM Plex Mono', monospace" }}>No flags</span>
          </div>
        )}
      </CollapsiblePanel>

      {!isMobile && (
        <button type="button" onClick={onClose} style={{ marginTop: 24, background: "none", border: "1px solid #d4c9bc", borderRadius: 5, padding: "8px 16px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#a09080", letterSpacing: "0.07em", textTransform: "uppercase" }}>← Back to document</button>
      )}
    </>
  );
}

function buildResultText(sections: DocSection[], active: DocSection | undefined): string {
  const target = active ? [active] : sections;
  return target.map((section) => [section.label, "", "Original:", section.raw, "", "Plain meaning:", section.meaning, "", "Source:", section.origin.source, section.origin.url || "", "", "Verification:", section.verification.crossRef, section.verification.note].filter(Boolean).join("\n")).join("\n\n---\n\n");
}

export function MeaningNavigatorView({ sections, title, jurisdiction, answerLanguage, onAnswerLanguageChange }: { sections: DocSection[]; title: string; jurisdiction: string; answerLanguage: string; onAnswerLanguageChange: (language: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copy export");
  const isMobile = useIsMobile();
  const active = sections.find((section) => section.id === selected);
  const resultText = buildResultText(sections, active);

  const copyResult = async () => {
    await navigator.clipboard.writeText(resultText);
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus("Copy export"), 1600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0eb", fontFamily: "'Crimson Pro', Georgia, serif", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } } @keyframes slideIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } } @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } } * { box-sizing: border-box; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #c9bfb5; border-radius: 2px; }`}</style>
      <header style={{ borderBottom: "1px solid #d4c9bc", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#faf7f4", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c17f3a", flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8a7f72", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tetherpoint</span>
          <span style={{ color: "#c9bfb5" }}>·</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#b0a595", letterSpacing: "0.06em" }}>Meaning Navigator</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select value={answerLanguage} onChange={(event) => onAnswerLanguageChange(event.target.value)} aria-label="Language" style={{ background: "#fff", border: "1px solid #d4c9bc", borderRadius: 4, padding: "4px 7px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#5c4a3a", letterSpacing: "0.05em" }}>
            {ANSWER_LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
          <button type="button" onClick={copyResult} style={{ background: "#e8f4ec", border: "1px solid #b7ddc4", borderRadius: 4, padding: "4px 7px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#2d6a4f", letterSpacing: "0.05em", cursor: "pointer" }}>{copyStatus}</button>
        </div>
      </header>
      {!selected && <div style={{ background: "#ede8e3", borderBottom: "1px solid #d4c9bc", padding: "7px 20px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#a09080", letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0 }}>{isMobile ? "Tap a section to reveal its meaning" : "↓ Select a section to reveal its meaning"}</div>}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ flex: !isMobile && active ? "0 0 52%" : "1 1 100%", transition: "flex 0.3s ease", overflowY: "auto", padding: isMobile ? "24px 16px 120px" : "32px 36px", borderRight: !isMobile && active ? "1px solid #d4c9bc" : "none" }}>
          <div style={{ maxWidth: isMobile ? "100%" : 640 }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 500, color: "#2a1f1a", lineHeight: 1.3, marginBottom: 5 }}>{title}</h1>
              <p style={{ fontSize: 12, color: "#9a8a7a", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>Jurisdiction: {jurisdiction}</p>
            </div>
            {sections.map((section) => {
              const isActive = selected === section.id;
              const isHovered = hovered === section.id;
              return (
                <div key={section.id} onClick={() => setSelected((previous) => previous === section.id ? null : section.id)} onMouseEnter={() => setHovered(section.id)} onMouseLeave={() => setHovered(null)} style={{ marginBottom: 6, borderRadius: 7, border: isActive ? "1.5px solid #c17f3a" : isHovered ? "1.5px solid #d4c9bc" : "1.5px solid transparent", background: isActive ? "#fffaf4" : isHovered ? "#faf7f4" : "transparent", cursor: "pointer", transition: "all 0.15s ease", overflow: "hidden", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ padding: "9px 14px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: isActive ? "#c17f3a" : "#a09080", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{section.label}</span>
                    {isActive && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#c17f3a" }}>✦</span>}
                  </div>
                  <p style={{ padding: "4px 14px 13px", fontSize: isMobile ? 15 : 15.5, lineHeight: 1.75, color: "#3d3530" }}>{section.raw}</p>
                  {isActive && <div style={{ height: 2, background: "linear-gradient(90deg, #c17f3a, #e8c99a)", margin: "0 14px 10px" }} />}
                </div>
              );
            })}
          </div>
        </div>
        {!isMobile && active && <div style={{ flex: "0 0 48%", overflowY: "auto", padding: "28px 28px 48px", background: "#faf7f4", animation: "slideIn 0.22s ease" }}><MeaningContent active={active} onClose={() => setSelected(null)} isMobile={false} answerLanguage={answerLanguage} /></div>}
      </div>
      {isMobile && active && <><div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(42,31,26,0.35)", zIndex: 40, animation: "fadeIn 0.2s ease" }} /><div style={{ position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "78vh", background: "#faf7f4", borderRadius: "14px 14px 0 0", boxShadow: "0 -4px 32px rgba(42,31,26,0.18)", zIndex: 50, display: "flex", flexDirection: "column", animation: "sheetUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}><div style={{ padding: "10px 20px 0", flexShrink: 0, borderBottom: "1px solid #e8e0d8" }}><div style={{ display: "flex", justifyContent: "center", paddingBottom: 10 }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "#d4c9bc" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#c17f3a", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{active.label}</span><button type="button" onClick={() => setSelected(null)} style={{ background: "#ede8e3", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8a7f72", fontSize: 14, lineHeight: 1, fontFamily: "sans-serif" }}>×</button></div></div><div style={{ overflowY: "auto", padding: "16px 20px 40px", flex: 1 }}><MeaningContent active={active} onClose={() => setSelected(null)} isMobile={true} answerLanguage={answerLanguage} /></div></div></>}
    </div>
  );
}
