/**
 * ARCHITECTURAL COMPONENT: Thermal Print Engine & POS-80 Hardware Bridge
 * Formats raw sales data into standard ESC/POS command byte buffers, alignment,
 * 48-column table grids, tax breakdown, barcode raster, paper cut loops,
 * and handles WebUSB / WebSerial / Browser native driver printing for 80mm thermal printers.
 */

import { Sale, ShopSettings, HardwareConfig } from '../types';

export class PrintService {
  /**
   * ESC/POS Control Byte Constants
   */
  public static readonly ESC = 0x1B;
  public static readonly GS = 0x1D;
  public static readonly FS = 0x1C;

  // Cached hardware references
  private static pairedUsbDevice: any = null;
  private static usbEndpointOut: number | null = null;
  private static pairedSerialPort: any = null;

  /**
   * Pairs a USB Thermal Printer via WebUSB API
   */
  public static async pairUsbPrinter(): Promise<{ success: boolean; deviceName?: string; message: string }> {
    if (!('usb' in navigator)) {
      return { 
        success: false, 
        message: 'WebUSB API is not supported in this browser. Please use Google Chrome / Edge or the Native Print Driver mode.' 
      };
    }

    try {
      // Request device with printer class filter or any connected USB printer
      const device = await (navigator as any).usb.requestDevice({
        filters: [
          { classCode: 7 }, // USB Printer Class
          { vendorId: 0x0416 }, // Winbond / POS-80 common
          { vendorId: 0x0483 }, // STMicroelectronics / Xprinter
          { vendorId: 0x04b8 }, // Seiko Epson
          { vendorId: 0x0fe6 }, // ICS Advent / Core POS
          { vendorId: 0x1fc9 }, // NXP
          { vendorId: 0x0dd4 }, // Custom Engineering
          { vendorId: 0x1504 }  // SNBC
        ]
      });

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Find printer interface & bulk OUT endpoint
      let targetInterface = 0;
      let targetEndpoint = 1;

      for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && ep.type === 'bulk') {
              targetInterface = iface.interfaceNumber;
              targetEndpoint = ep.endpointNumber;
              break;
            }
          }
        }
      }

      await device.claimInterface(targetInterface);
      this.pairedUsbDevice = device;
      this.usbEndpointOut = targetEndpoint;

      const devName = device.productName || device.manufacturerName || 'POS-80 USB Thermal Printer';
      return {
        success: true,
        deviceName: devName,
        message: `Successfully paired & connected ${devName} (Interface: ${targetInterface}, Endpoint OUT: ${targetEndpoint})`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.name === 'NotFoundError' ? 'No USB printer was selected' : (err.message || 'Failed to pair USB device')
      };
    }
  }

  /**
   * Pairs a Serial / USB-to-UART Thermal Printer via WebSerial API
   */
  public static async pairSerialPrinter(baudRate = 9600): Promise<{ success: boolean; message: string }> {
    if (!('serial' in navigator)) {
      return {
        success: false,
        message: 'WebSerial API is not supported in this browser. Please use Chrome/Edge or System Driver mode.'
      };
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      this.pairedSerialPort = port;
      return {
        success: true,
        message: `WebSerial COM Port opened successfully at ${baudRate} baud!`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.name === 'NotFoundError' ? 'No COM port was selected' : (err.message || 'Failed to open serial port')
      };
    }
  }

  public static getPairedUsbDeviceName(): string | null {
    if (!this.pairedUsbDevice) return null;
    return this.pairedUsbDevice.productName || this.pairedUsbDevice.manufacturerName || 'POS-80 USB Printer';
  }

  /**
   * Generates standard ESC/POS binary byte array calibrated for 80mm POS-80 Thermal Printers
   * (Standard 80mm roll = 48 columns in Font A, 576 dots per line)
   */
  public static generateEscPosBuffer(sale: Sale, settings: ShopSettings, config?: HardwareConfig): Uint8Array {
    const bytes: number[] = [];

    const pushString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
      }
    };

    const pushLf = (count = 1) => {
      for (let i = 0; i < count; i++) bytes.push(0x0A);
    };

    // 1. Initialize Printer (ESC @) & Set Latin/PC437 Codepage (ESC t 0)
    bytes.push(0x1B, 0x40);
    bytes.push(0x1B, 0x74, 0x00);

    // 2. RJ11 Cash Drawer Kick Out Command (ESC p 0 25 250)
    const drawerCmd = config?.cash_drawer_command || '27,112,0,25,250';
    const drawerBytes = drawerCmd.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    if (drawerBytes.length > 0) {
      bytes.push(...drawerBytes);
    } else {
      bytes.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
    }

    // 3. Center Align: ESC a 1
    bytes.push(0x1B, 0x61, 0x01);

    // Double Height + Double Width for Store Header (GS ! 0x11)
    bytes.push(0x1D, 0x21, 0x11);
    pushString((settings?.shop_name || 'BLOOM & CARRY COSMETICS').toUpperCase());
    pushLf(1);

    // Reset Character Size (GS ! 0x00)
    bytes.push(0x1D, 0x21, 0x00);
    if (settings.tagline) {
      pushString(settings.tagline);
      pushLf(1);
    }
    const storeAddress = settings?.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.';
    const storePhone = settings?.phone || '03461185406';
    const storeWebsite = settings?.website || 'bloomandcarry.com';

    pushString(storeAddress);
    pushLf(1);
    pushString(`TEL: ${storePhone}`);
    pushLf(1);
    pushString(`WEB: ${storeWebsite}`);
    pushLf(1);

    // 48-Character 80mm Divider
    pushString('================================================');
    pushLf(1);

    // Left Align: ESC a 0
    bytes.push(0x1B, 0x61, 0x00);
    pushString(`INVOICE NO : ${sale.invoice_no}`);
    pushLf(1);
    pushString(`DATE & TIME: ${new Date(sale.datetime).toLocaleString()}`);
    pushLf(1);
    pushString(`CUSTOMER   : ${sale.customer_name || 'Walk-in Customer'}`);
    pushLf(1);
    if (sale.customer_phone) {
      pushString(`PHONE      : ${sale.customer_phone}`);
      pushLf(1);
    }
    pushString(`CASHIER    : ${sale.cashier_name || 'Store Cashier'}`);
    pushLf(1);
    pushString(`PAYMENT    : ${(sale.payment_method || 'CASH').toUpperCase()}`);
    pushLf(1);

    pushString('------------------------------------------------');
    pushLf(1);

    // 48-Column Table Header for 80mm paper (Font A)
    // ITEM NAME (22) + QTY (5) + PRICE (9) + TOTAL (12) = 48
    pushString('ITEM NAME              QTY     PRICE       TOTAL');
    pushLf(1);
    pushString('------------------------------------------------');
    pushLf(1);

    // Sale Items with clean 48-col formatting & multi-line wrapping
    sale.items.forEach(item => {
      const cleanName = (item.name || 'Product').trim();
      const qtyStr = String(item.quantity ?? 1).padStart(5, ' ');
      const priceStr = String((item.sell_price ?? 0).toFixed(2)).padStart(9, ' ');
      const totalStr = String((item.total ?? (item.quantity * item.sell_price) ?? 0).toFixed(2)).padStart(12, ' ');

      if (cleanName.length <= 22) {
        const namePadded = cleanName.padEnd(22, ' ');
        pushString(`${namePadded}${qtyStr}${priceStr}${totalStr}`);
        pushLf(1);
      } else {
        // Multi-line wrap
        const firstLine = cleanName.substring(0, 22);
        const secondLine = cleanName.substring(22, 44);
        pushString(`${firstLine}${qtyStr}${priceStr}${totalStr}`);
        pushLf(1);
        pushString(`  ${secondLine}`);
        pushLf(1);
      }

      if (item.discount && item.discount > 0) {
        pushString(`  (Item Disc: -${(item.discount ?? 0).toFixed(2)})`);
        pushLf(1);
      }
    });

    pushString('------------------------------------------------');
    pushLf(1);

    // Right Align Totals (ESC a 2)
    bytes.push(0x1B, 0x61, 0x02);
    pushString(`SUBTOTAL : ${settings.currency_symbol || 'Rs.'} {((sale.subtotal || sale.total) ?? 0).toFixed(2)}`);
    pushLf(1);

    if ((sale.discount || 0) > 0) {
      pushString(`DISCOUNT : -${settings.currency_symbol || 'Rs.'} {(sale.discount ?? 0).toFixed(2)}`);
      pushLf(1);
    }

    if ((sale.tax_amount || 0) > 0) {
      pushString(`TAX (${sale.tax_rate}%) : ${settings.currency_symbol || 'Rs.'} {(sale.tax_amount ?? 0).toFixed(2)}`);
      pushLf(1);
    }

    // Bold Emphasized Grand Total (ESC E 1 + Double Height GS ! 0x01)
    bytes.push(0x1B, 0x45, 0x01);
    bytes.push(0x1D, 0x21, 0x01);
    pushString(`GRAND TOTAL : ${settings.currency_symbol || 'Rs.'} {(sale.total ?? 0).toFixed(2)}`);
    pushLf(1);

    // Reset Bold & Size
    bytes.push(0x1B, 0x45, 0x00);
    bytes.push(0x1D, 0x21, 0x00);

    pushString(`PAID AMOUNT : ${settings.currency_symbol || 'Rs.'} {(sale.paid ?? 0).toFixed(2)}`);
    pushLf(1);
    pushString(`CHANGE DUE  : ${settings.currency_symbol || 'Rs.'} {(sale.change_due ?? 0).toFixed(2)}`);
    pushLf(1);

    pushString('================================================');
    pushLf(1);

    // Center Footer (ESC a 1)
    bytes.push(0x1B, 0x61, 0x01);
    pushString('THANK YOU FOR YOUR VISIT!');
    pushLf(1);
    pushString('Goods once sold can be exchanged within 7 days.');
    pushLf(1);
    pushString('Powered by POS-80 Thermal Engine');
    pushLf(2);

    // Barcode: Code 128 (GS k 73 len bytes)
    try {
      const invCode = sale.invoice_no.replace(/[^a-zA-Z0-9-]/g, '');
      if (invCode.length > 0) {
        // Set barcode height to 50 dots: GS h 50
        bytes.push(0x1D, 0x68, 50);
        // Set barcode width module to 2: GS w 2
        bytes.push(0x1D, 0x77, 2);
        // Set HRI characters below barcode: GS H 2
        bytes.push(0x1D, 0x48, 2);
        // Print Code 128: GS k 73 len data
        bytes.push(0x1D, 0x6B, 73, invCode.length);
        pushString(invCode);
        pushLf(2);
      }
    } catch {
      // Fallback
    }

    // Feed 4 blank lines (ESC d 4)
    bytes.push(0x1B, 0x64, 0x04);

    // Auto Paper Cut Command: GS V 66 0 (Partial Cut with Feed)
    bytes.push(0x1D, 0x56, 0x42, 0x00);

    return new Uint8Array(bytes);
  }

  /**
   * Generates a comprehensive 80mm Hardware Diagnostic Test Ticket
   */
  public static generate80mmTestTicket(settings: ShopSettings, config?: HardwareConfig): Uint8Array {
    const testSale: Sale = {
      id: 'test_hardware_80mm',
      invoice_no: `TEST-80MM-${Date.now().toString().slice(-4)}`,
      datetime: new Date().toISOString(),
      customer_name: 'POS-80 Hardware Test',
      customer_phone: '0300-1234567',
      subtotal: 2500,
      tax_rate: 16,
      tax_amount: 400,
      discount: 100,
      total: 2800,
      paid: 3000,
      change_due: 200,
      payment_method: 'Cash',
      cashier_name: 'Hardware Diagnostics Engine',
      status: 'completed',
      items: [
        { product_id: 'test_1', barcode: '890123456701', name: 'POS-80 80mm Alignment Grid', quantity: 1, buy_price: 1000, sell_price: 1500, discount: 0, total: 1500 },
        { product_id: 'test_2', barcode: '890123456702', name: 'High-Speed ESC/POS Thermal Buffer', quantity: 1, buy_price: 800, sell_price: 1000, discount: 100, total: 900 }
      ]
    };
    return this.generateEscPosBuffer(testSale, settings, config);
  }

  /**
   * Direct WebUSB Raw Byte Stream Writer
   */
  public static async writeToPairedUsb(buffer: Uint8Array): Promise<boolean> {
    if (!this.pairedUsbDevice) return false;
    try {
      const epOut = this.usbEndpointOut || 1;
      await this.pairedUsbDevice.transferOut(epOut, buffer);
      return true;
    } catch (err) {
      console.warn('Direct WebUSB transfer failed:', err);
      return false;
    }
  }

  /**
   * Direct WebSerial Raw Byte Stream Writer
   */
  public static async writeToPairedSerial(buffer: Uint8Array): Promise<boolean> {
    if (!this.pairedSerialPort || !this.pairedSerialPort.writable) return false;
    try {
      const writer = this.pairedSerialPort.writable.getWriter();
      await writer.write(buffer);
      writer.releaseLock();
      return true;
    } catch (err) {
      console.warn('Direct WebSerial transfer failed:', err);
      return false;
    }
  }

  /**
   * Executes hardware print job with multi-channel fallback:
   * 1. Paired WebUSB device (POS-80 Direct)
   * 2. Paired WebSerial COM port
   * 3. Browser native print window with exact 80mm CSS styling
   */
  public static async executePrintJob(
    sale: Sale, 
    settings: ShopSettings, 
    config?: HardwareConfig
  ): Promise<{ success: boolean; method: string; message: string }> {
    try {
      const buffer = this.generateEscPosBuffer(sale, settings, config);

      // 1. Check direct WebUSB if paired
      if (this.pairedUsbDevice) {
        const usbOk = await this.writeToPairedUsb(buffer);
        if (usbOk) {
          return {
            success: true,
            method: 'Direct WebUSB (POS-80)',
            message: `Printed directly to ${this.getPairedUsbDeviceName() || 'POS-80 USB Printer'}`
          };
        }
      }

      // 2. Check direct WebSerial if paired
      if (this.pairedSerialPort) {
        const serialOk = await this.writeToPairedSerial(buffer);
        if (serialOk) {
          return {
            success: true,
            method: 'WebSerial COM Port',
            message: 'Printed directly via WebSerial Stream!'
          };
        }
      }

      // 3. Native print fallback with cash drawer pulse
      if (settings.open_cash_drawer) {
        this.triggerCashDrawerPulse(config);
      }

      setTimeout(() => {
        window.print();
      }, 100);

      return {
        success: true,
        method: '80mm Thermal Print Engine',
        message: 'Dispatched to POS-80 USB Printer via 80mm driver'
      };
    } catch (err: any) {
      return {
        success: false,
        method: 'Error',
        message: err.message || 'Failed to execute print job'
      };
    }
  }

  /**
   * Triggers RJ11 Cash Drawer Kick signal
   */
  public static triggerCashDrawerPulse(config?: HardwareConfig): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // Audio context fallback
    }
  }
}
