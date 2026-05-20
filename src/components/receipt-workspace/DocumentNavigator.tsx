import { useMemo } from "react";
import type { PipelineResponse } from "../../types/pipeline";
import { buildDocSections, sourceNameLabel } from "./meaning-navigator-model";
import { MeaningNavigatorView } from "./MeaningNavigatorView";

export function DocumentNavigator({
  data,
  answerLanguage,
  onAnswerLanguageChange,
}: {
  data: PipelineResponse;
  answerLanguage: string;
  onAnswerLanguageChange: (language: string) => void;
}) {
  const sections = useMemo(() => buildDocSections(data), [data]);
  const jurisdiction = data.jurisdiction_context?.user_selected_state || "I don't know";

  return (
    <MeaningNavigatorView
      sections={sections}
      title={sourceNameLabel(data)}
      jurisdiction={jurisdiction}
      answerLanguage={answerLanguage}
      onAnswerLanguageChange={onAnswerLanguageChange}
    />
  );
}
