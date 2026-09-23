import { useEffect } from 'react';
import { EscPosService } from './escpos';

/**
 * Global Barcode Listener Hook for USB Barcode Scanners
 * Detects rapid typing (<35ms interval) followed by Enter
 */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const target = e.target as HTMLElement;

      // Ignore if user is actively typing in a standard text input/textarea (unless input has data-barcode-input)
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !target.hasAttribute('data-barcode-input')
      ) {
        return;
      }

      // Check key gap
      const gap = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          const scannedCode = buffer.trim();
          buffer = '';
          EscPosService.playScanBeep();
          onScan(scannedCode);
        } else {
          buffer = '';
        }
        return;
      }

      // If gap is too large (>60ms), reset buffer for non-fast typing
      if (gap > 60 && buffer.length > 0) {
        buffer = '';
      }

      // Printable single char
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}

/**
 * Pure SVG Code128 Barcode Generator
 */
export function generateBarcodeSVG(code: string, width: number = 200, height: number = 60): string {
  // Simple Code 128 / Code 39 pattern converter for visual SVG rendering
  const safeCode = (code || '123456789').toUpperCase();
  
  // Convert characters to pseudo bar widths for clear SVG rendering
  let bars: number[] = [2, 1, 1, 2, 1, 1]; // Start guard
  
  for (let i = 0; i < safeCode.length; i++) {
    const charCode = safeCode.charCodeAt(i);
    const w1 = (charCode % 3) + 1;
    const w2 = ((charCode * 2) % 3) + 1;
    const w3 = ((charCode * 3) % 2) + 1;
    bars.push(w1, w2, w3, 1);
  }
  
  bars.push(2, 2, 1, 2, 1, 2); // Stop guard
  
  const totalUnits = bars.reduce((a, b) => a + b, 0);
  const unitWidth = width / totalUnits;
  
  let currentX = 0;
  let svgPaths = '';
  
  bars.forEach((barWidth, index) => {
    const barW = barWidth * unitWidth;
    if (index % 2 === 0) {
      // Black bar
      svgPaths += `<rect x="${(currentX ?? 0).toFixed(2)}" y="0" width="${(barW ?? 0).toFixed(2)}" height="${height - 18}" fill="#000000" />`;
    }
    currentX += barW;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="mx-auto">
      <rect width="100%" height="100%" fill="#ffffff" />
      ${svgPaths}
      <text x="${width / 2}" y="${height - 4}" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle" fill="#000000">${safeCode}</text>
    </svg>
  `;
}
