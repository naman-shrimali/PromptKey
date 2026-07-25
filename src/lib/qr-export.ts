// Client-side QR export helpers: SVG download, 1024px PNG download, and
// copy-image (SPEC §5.1). All work from the rendered <svg> so the exact
// on-screen QR is what gets exported.

const QUIET_ZONE_RATIO = 0.12; // ≥ 4 modules on typical QR sizes (SPEC §8)

/**
 * Serialize the QR <svg> into a standalone SVG string with a white
 * background and quiet zone. QR modules must stay dark-on-light in every
 * export, regardless of theme (SPEC §8) — the source svg already renders
 * dark modules; we add the white backdrop.
 */
export function qrSvgString(svg: SVGSVGElement): string {
    const viewBox = (svg.getAttribute("viewBox") || "0 0 256 256").split(/\s+/).map(Number);
    const [x, y, w, h] = viewBox;
    const margin = Math.max(w, h) * QUIET_ZONE_RATIO;
    const vb = `${x - margin} ${y - margin} ${w + margin * 2} ${h + margin * 2}`;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">` +
        `<rect x="${x - margin}" y="${y - margin}" width="${w + margin * 2}" height="${h + margin * 2}" fill="#ffffff"/>` +
        svg.innerHTML +
        `</svg>`
    );
}

function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
}

export function downloadQrSvg(svg: SVGSVGElement, filename = "promptkey-qr.svg") {
    const blob = new Blob([qrSvgString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    URL.revokeObjectURL(url);
}

async function qrPngBlob(svg: SVGSVGElement, size = 1024): Promise<Blob> {
    const svgUrl = URL.createObjectURL(
        new Blob([qrSvgString(svg)], { type: "image/svg+xml" })
    );
    try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("Failed to rasterize QR"));
            image.src = svgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
        );
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

export async function downloadQrPng(svg: SVGSVGElement, filename = "promptkey-qr.png") {
    const blob = await qrPngBlob(svg, 1024);
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    URL.revokeObjectURL(url);
}

export async function copyQrImage(svg: SVGSVGElement): Promise<void> {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("Clipboard images aren't supported in this browser");
    }
    // Safari requires the ClipboardItem promise form inside the user gesture.
    await navigator.clipboard.write([
        new ClipboardItem({ "image/png": qrPngBlob(svg, 1024) }),
    ]);
}
