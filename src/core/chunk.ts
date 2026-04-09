/**
 * Split text into chunks respecting channel max length.
 */
export function chunkMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const target = maxLength - 200;
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitAt = -1;
    for (const pos of findSplitCandidates(remaining, target)) {
      if (pos > 0) {
        splitAt = pos;
        break;
      }
    }

    if (splitAt <= 0) splitAt = target;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (chunks.length > 1) {
    return chunks.map((chunk, i) => `[${i + 1}/${chunks.length}]\n${chunk}`);
  }
  return chunks;
}

function* findSplitCandidates(
  text: string,
  target: number,
): Generator<number> {
  const searchEnd = Math.min(target, text.length - 1);

  let idx = text.lastIndexOf("\n\n", searchEnd);
  if (idx > 0) yield idx + 2;

  idx = text.lastIndexOf("\n", searchEnd);
  if (idx > 0) yield idx + 1;

  idx = text.lastIndexOf(". ", searchEnd);
  if (idx > 0) yield idx + 2;

  idx = text.lastIndexOf(" ", searchEnd);
  if (idx > 0) yield idx + 1;
}
