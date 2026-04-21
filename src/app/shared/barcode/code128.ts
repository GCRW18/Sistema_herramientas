/**
 * Code128 barcode SVG generator (subset B — printable ASCII 32-126).
 * Produces a standards-compliant barcode readable by any laser/CCD scanner.
 */

const CODE128_B_START = 104;
const CODE128_STOP    = 106;

// Bar/space patterns for Code128 (11 bits per symbol, MSB first).
// Each entry is a 6-bar pattern encoded as 6 widths [b,s,b,s,b,s].
const PATTERNS: number[][] = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
    [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
    [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
    [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
    [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,3,1,1,3],[1,1,3,3,1,1],[1,3,3,1,1,1],
    [3,1,3,1,1,1],[2,1,1,1,2,3],[2,1,1,3,2,1],[2,3,1,1,2,1],[1,1,2,1,3,3],
    [1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],
    [3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],
    [3,3,2,1,1,1],[3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],
    [1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],
    [1,1,2,2,1,4],[1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],
    [1,4,2,2,1,1],[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],
    [1,3,4,1,1,1],[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],
    [1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],
    [2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],
    [1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],
    [1,1,3,1,4,1],[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],
    [2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1],[1,1,2,1,1,4], // stop extra
];

function encode(text: string): number[] {
    const codes: number[] = [CODE128_B_START];
    let checksum = CODE128_B_START;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i) - 32; // Code128-B offset
        codes.push(c);
        checksum += c * (i + 1);
    }
    codes.push(checksum % 103);
    codes.push(CODE128_STOP);
    return codes;
}

function patternToWidths(code: number): number[] {
    return PATTERNS[code] ?? [1, 1, 1, 1, 1, 1];
}

/**
 * Generates a Code128-B barcode as an inline SVG string.
 *
 * @param text    The string to encode (printable ASCII)
 * @param height  Bar height in px (default 50)
 * @param xScale  Width multiplier per module unit (default 2)
 */
export function generateCode128Svg(text: string, height = 50, xScale = 2): string {
    const codes = encode(text);
    const quietZoneModules = 10;

    // Build bars array: alternating bar/space widths (bar first)
    const allWidths: Array<{ w: number; bar: boolean }> = [];
    allWidths.push({ w: quietZoneModules, bar: false }); // left quiet zone

    for (const code of codes) {
        const widths = patternToWidths(code);
        widths.forEach((w, i) => {
            allWidths.push({ w, bar: i % 2 === 0 });
        });
        // stop bar has an extra termination bar of width 2
        if (code === CODE128_STOP) {
            allWidths.push({ w: 2, bar: true });
            allWidths.push({ w: 2, bar: false });
        }
    }

    allWidths.push({ w: quietZoneModules, bar: false }); // right quiet zone

    const totalModules = allWidths.reduce((s, e) => s + e.w, 0);
    const svgWidth = totalModules * xScale;
    const textY = height + 12;
    const svgHeight = textY + 4;

    let rects = '';
    let x = 0;
    for (const seg of allWidths) {
        const pw = seg.w * xScale;
        if (seg.bar) {
            rects += `<rect x="${x}" y="0" width="${pw}" height="${height}" fill="#000"/>`;
        }
        x += pw;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#fff"/>
  ${rects}
  <text x="${svgWidth / 2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="10" fill="#000">${text}</text>
</svg>`;
}
