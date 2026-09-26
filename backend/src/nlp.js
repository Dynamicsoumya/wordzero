const RULES = [
  { id: "weakness", label: "Weakness", test: /weakness|kamzori|kamzor|कमजोरी|कमजोर|durbal/i },
  { id: "breathing", label: "Breathing difficulty", test: /saans|सांस|breath|dyspnea|shortness|oxygen/i },
  { id: "fever", label: "Fever", test: /bukhar|बुखार|fever|temperature/i },
  { id: "pain", label: "Pain", test: /dard|दर्द|\bpain\b/i },
  { id: "dizzy", label: "Dizziness", test: /chakkar|चक्कर|dizz/i },
];

const KNOWN = [
  {
    test: /weakness aur saans|saans lene mein dikkat/i,
    reading: "The note describes weakness and difficulty breathing.",
  },
];

export function analyzeNote(text, language) {
  const source = String(text || "");
  const findings = RULES.filter((rule) => rule.test.test(source)).map((rule) => ({
    id: rule.id,
    label: rule.label,
    matched: source.match(rule.test)?.[0] || rule.label,
  }));
  const known = KNOWN.find((item) => item.test.test(source));
  return {
    language: language || "Hindi",
    reading: known
      ? known.reading
      : findings.length
        ? `The note mentions ${findings.map((item) => item.label.toLowerCase()).join(", ")}.`
        : "No supported symptom words were found in this note.",
    findings,
    matchedRules: findings.length,
    rulesChecked: RULES.length,
    method: `Matched ${findings.length} of ${RULES.length} symptom rules in the note text. This count is not an accuracy score.`,
  };
}
