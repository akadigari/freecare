// The result as a short plain text for the phone's share sheet or the clipboard: the answer,
// the math, the deadline, the law. Only the numbers the person typed, nothing else about them.

export function shareText(view, lang = 'en') {
  const basedOn = lang === 'es' ? 'Basado en' : 'Based on';
  const sources = view.sources.map((s) => s.label).join(', ');
  return `${view.headline} ${view.detail} ${view.deadlineText}\n\n${basedOn} ${sources}. ${view.notes.at(-1)}`;
}
