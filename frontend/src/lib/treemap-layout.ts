// Squarified treemap layout (Bruls, Huizing & van Wijk). Pure geometry so it can be unit-tested
// in isolation from the SVG that renders it: given weighted items and a box, it returns a
// non-overlapping rectangle per item whose area is proportional to the item's value.

export type TreemapInput = {
  id: string;
  /** Positive weight; the rectangle's area is proportional to this. Non-positive items are dropped. */
  value: number;
};

export type TreemapRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScaledItem = { id: string; area: number };
type Box = { x: number; y: number; width: number; height: number };

/** Worst (largest) aspect ratio a row would reach if laid along a side of the given length. */
function worstAspectRatio(row: ScaledItem[], side: number): number {
  if (row.length === 0) return Infinity;
  const sum = row.reduce((total, item) => total + item.area, 0);
  const max = Math.max(...row.map((item) => item.area));
  const min = Math.min(...row.map((item) => item.area));
  const side2 = side * side;
  const sum2 = sum * sum;
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

/**
 * Places one finished row of items against the shorter side of `box` and returns the box that
 * remains for the rest of the items. Pushes the placed rectangles into `output`.
 */
function layoutRow(row: ScaledItem[], box: Box, output: TreemapRect[]): Box {
  const sum = row.reduce((total, item) => total + item.area, 0);

  // Lay the row along the shorter side so tiles stay close to square.
  if (box.width >= box.height) {
    const columnWidth = sum / box.height;
    let y = box.y;
    for (const item of row) {
      const cellHeight = item.area / columnWidth;
      output.push({ id: item.id, x: box.x, y, width: columnWidth, height: cellHeight });
      y += cellHeight;
    }
    return { x: box.x + columnWidth, y: box.y, width: box.width - columnWidth, height: box.height };
  }

  const rowHeight = sum / box.width;
  let x = box.x;
  for (const item of row) {
    const cellWidth = item.area / rowHeight;
    output.push({ id: item.id, x, y: box.y, width: cellWidth, height: rowHeight });
    x += cellWidth;
  }
  return { x: box.x, y: box.y + rowHeight, width: box.width, height: box.height - rowHeight };
}

/**
 * Computes a squarified treemap layout for `items` inside a `width` × `height` box.
 * Items are scaled so their combined area fills the box; larger values get larger tiles.
 */
export function computeTreemapLayout(
  items: TreemapInput[],
  width: number,
  height: number
): TreemapRect[] {
  const positive = items.filter((item) => item.value > 0);
  if (positive.length === 0 || width <= 0 || height <= 0) return [];

  const totalValue = positive.reduce((total, item) => total + item.value, 0);
  const boxArea = width * height;
  const scaled: ScaledItem[] = positive
    .map((item) => ({ id: item.id, area: (item.value / totalValue) * boxArea }))
    .sort((first, second) => second.area - first.area);

  const output: TreemapRect[] = [];
  let box: Box = { x: 0, y: 0, width, height };
  let row: ScaledItem[] = [];
  let index = 0;

  while (index < scaled.length) {
    const side = Math.min(box.width, box.height);
    const candidate = scaled[index];
    if (
      row.length === 0 ||
      worstAspectRatio(row, side) >= worstAspectRatio([...row, candidate], side)
    ) {
      row.push(candidate);
      index += 1;
    } else {
      box = layoutRow(row, box, output);
      row = [];
    }
  }
  if (row.length > 0) layoutRow(row, box, output);

  return output;
}
