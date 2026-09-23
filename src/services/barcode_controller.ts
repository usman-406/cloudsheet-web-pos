/**
 * ARCHITECTURAL COMPONENT: Barcode Controller & Hardware Input Listener
 * Captures hardware inputs from barcode scanner via Serial/USB COM port emulation or keyboard wedge interception.
 */

export type BarcodeScanCallback = (barcode: string) => void;

export class BarcodeController {
  private static instance: BarcodeController;
  private listeners: Set<BarcodeScanCallback> = new Set();
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private isListening: boolean = false;

  private constructor() {
    this.initKeyboardWedgeListener();
  }

  public static getInstance(): BarcodeController {
    if (!BarcodeController.instance) {
      BarcodeController.instance = new BarcodeController();
    }
    return BarcodeController.instance;
  }

  public registerCallback(callback: BarcodeScanCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emitBarcode(barcode: string) {
    const cleaned = barcode.trim();
    if (cleaned.length < 2) return;

    this.playScanBeep();
    this.listeners.forEach(cb => cb(cleaned));
  }

  private initKeyboardWedgeListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const target = e.target as HTMLElement;

      // Ignore standard form inputs unless explicitly tagged for barcode interception
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !target.hasAttribute('data-barcode-input')
      ) {
        return;
      }

      const gap = currentTime - this.lastKeyTime;
      this.lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (this.buffer.length >= 3) {
          e.preventDefault();
          const code = this.buffer;
          this.buffer = '';
          this.emitBarcode(code);
        } else {
          this.buffer = '';
        }
        return;
      }

      // Scanner chars arrive rapidly (<40ms interval). Reset if human typing gap (>60ms)
      if (gap > 60 && this.buffer.length > 0) {
        this.buffer = '';
      }

      if (e.key.length === 1) {
        this.buffer += e.key;
      }
    });
  }

  /**
   * Sound Feedback for Barcode Reader
   */
  public playScanBeep(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      // Audio context restricted or muted
    }
  }

  /**
   * Connect to WebSerial COM Port Barcode Scanner
   */
  public async connectSerialScanner(baudRate = 9600): Promise<{ success: boolean; message: string }> {
    if (!('serial' in navigator)) {
      return { success: false, message: 'WebSerial API not supported in this browser environment.' };
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let lineBuffer = '';
      (async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            lineBuffer += value;
            if (lineBuffer.includes('\n') || lineBuffer.includes('\r')) {
              const lines = lineBuffer.split(/[\r\n]+/);
              lineBuffer = lines.pop() || '';
              lines.forEach(line => {
                if (line.trim().length > 2) {
                  this.emitBarcode(line.trim());
                }
              });
            }
          }
        }
      })();

      return { success: true, message: 'Serial Barcode Reader Connected Successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Serial scanner connection cancelled or failed.' };
    }
  }
}
