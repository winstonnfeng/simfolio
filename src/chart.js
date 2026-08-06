// Chart geometry. Pure: series of numbers -> SVG path strings.

export function extent(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, span: max - min || 1 };
}

export function toPath(values, width, height, pad = 6) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const { min, span } = extent(values);
  const innerHeight = height - pad * 2;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = pad + innerHeight - ((value - min) / span) * innerHeight;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function toAreaPath(values, width, height, pad = 6) {
  const line = toPath(values, width, height, pad);
  return line ? `${line} L${width} ${height} L0 ${height} Z` : '';
}
