export interface RoutePinPosition {
  id: string;
  progress: number;
}

// Pack label intervals in pixels. Move edge labels inward, keeping GPS anchors fixed.
export function layoutRoutePins(positions: RoutePinPosition[], availableWidth: number) {
  const width = Math.max(0, availableWidth);
  const labelWidth = Math.min(144, width);
  const laneEnds: number[] = [];
  const pins = [...positions]
    .sort((a, b) => a.progress - b.progress || a.id.localeCompare(b.id))
    .map(({ id, progress }) => {
      const anchor = (Math.max(0, Math.min(100, progress)) / 100) * width;
      const left = Math.max(0, Math.min(width - labelWidth, anchor - labelWidth / 2));
      let lane = laneEnds.findIndex((end) => left >= end + 8);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = left + labelWidth;
      return { id, anchor, left, lane };
    });
  return { pins, labelWidth, height: Math.max(1, laneEnds.length) * 40 + 16 };
}
