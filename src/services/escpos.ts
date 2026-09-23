import { Sale, ShopSettings } from '../types';

export const EscPosService = {
  /**
   * Generates standard ESC/POS hex commands for cash drawer open & paper cut
   */
  getEscPosCommands(): { cashDrawerHex: string; paperCutHex: string; fullSampleHex: string } {
    // ESC p m t1 t2 -> Open cash drawer pin 2 (0x1B, 0x70, 0x00, 0x19, 0xFA)
    const cashDrawerHex = '1B 70 00 19 FA';
    // GS V m -> Full cut paper (0x1D, 0x56, 0x00)
    const paperCutHex = '1D 56 00';
    const fullSampleHex = `1B 40 (Initialize) \n1B 61 01 (Center Align) \n${cashDrawerHex} (Pulse Drawer) \n1D 56 00 (Cut Paper)`;
    
    return { cashDrawerHex, paperCutHex, fullSampleHex };
  },

  /**
   * Simulates Cash Drawer Kick signal or sends WebUSB / Web Serial / Audio pulse
   */
  triggerCashDrawer(): void {
    try {
      // Play a mechanical cash register sound effect
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.log('Cash drawer signal sound skipped:', e);
    }
  },

  /**
   * Play barcode scan beep sound
   */
  playScanBeep(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      // Silent catch if audio not allowed without user gesture
    }
  },

  /**
   * Trigger Browser Native Print Window with thermal receipt formatting
   */
  printReceipt(sale: Sale, settings: ShopSettings): void {
    if (settings.open_cash_drawer) {
      this.triggerCashDrawer();
    }

    // Trigger window.print() which renders the hidden #thermal-receipt element styled for @media print
    setTimeout(() => {
      window.print();
    }, 150);
  }
};
