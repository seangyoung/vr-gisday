export function wrapTextLines(ctx, text, maxWidth, preserveBreaks = false) {
  const paragraphs = preserveBreaks
    ? String(text).split(/\r?\n/)
    : String(text).split(/\r?\n\s*\r?\n/)
      .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " "));
  const lines = [];
  paragraphs.forEach((paragraph, index) => {
    if (index && !preserveBreaks) lines.push("");
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  });
  return lines;
}

export function fitWrappedText(ctx, text, {
  maxWidth, maxHeight, fontSize, minFontSize = 18,
  weight = 500, lineHeight = 1.2, preserveBreaks = false,
}) {
  for (let size = fontSize; size >= minFontSize; size--) {
    ctx.font = `${weight} ${Math.round(size)}px system-ui, sans-serif`;
    const lines = wrapTextLines(ctx, text, maxWidth, preserveBreaks);
    if (lines.length * size * lineHeight <= maxHeight &&
        lines.every((line) => ctx.measureText(line).width <= maxWidth))
      return { lines, size, spacing: size * lineHeight };
  }
  ctx.font = `${weight} ${minFontSize}px system-ui, sans-serif`;
  return {
    lines: wrapTextLines(ctx, text, maxWidth, preserveBreaks),
    size: minFontSize,
    spacing: minFontSize * lineHeight,
  };
}
