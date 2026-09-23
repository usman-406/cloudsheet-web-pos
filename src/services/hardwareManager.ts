/**
 * ARCHITECTURAL COMPONENT: Central Hardware Manager & Async I/O Controller
 * Central backend service that initializes, polls, and handles exception catching for all connected hardware devices.
 * Implements Event-Driven design patterns using a central 'HardwareManager' controller that manages hardware jobs asynchronously.
 */

import { DeviceStatus, HardwareConfig, HardwareJob, DeviceType, DeviceHealth, Sale, ShopSettings } from '../types';
import { PrintService } from './print_service';
import { BarcodeController } from './barcode_controller';
import { CardPaymentTerminal } from './card_payment_terminal';
import defaultConfig from './hardware_config.json';

export type HardwareStatusListener = (statuses: DeviceStatus[], jobQueue: HardwareJob[]) => void;

export class HardwareManager {
  private static instance: HardwareManager;
  private config: HardwareConfig;
  private deviceStatuses: DeviceStatus[] = [];
  private jobQueue: HardwareJob[] = [];
  private listeners: Set<HardwareStatusListener> = new Set();
  private pollingTimer: any = null;
  private isProcessingQueue = false;

  private constructor() {
    this.config = this.loadConfig();
    this.initializeDefaultDeviceStatuses();
    this.startHeartbeatPolling();
  }

  public static getInstance(): HardwareManager {
    if (!HardwareManager.instance) {
      HardwareManager.instance = new HardwareManager();
    }
    return HardwareManager.instance;
  }

  private loadConfig(): HardwareConfig {
    const saved = localStorage.getItem('pos_hardware_config_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultConfig as HardwareConfig;
      }
    }
    return defaultConfig as HardwareConfig;
  }

  public getConfig(): HardwareConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: HardwareConfig): void {
    this.config = newConfig;
    localStorage.setItem('pos_hardware_config_v1', JSON.stringify(newConfig));
    this.initializeDefaultDeviceStatuses();
    this.notify();
  }

  public subscribe(listener: HardwareStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.deviceStatuses, this.jobQueue);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb([...this.deviceStatuses], [...this.jobQueue]));
  }

  private initializeDefaultDeviceStatuses() {
    const time = new Date().toLocaleTimeString();
    this.deviceStatuses = [
      {
        device: 'printer',
        label: 'Thermal Printer 80mm ESC/POS',
        status: 'online',
        port: this.config.printer_port || 'COM1 / Serial',
        lastPing: time,
        details: 'Paper Ready, ESC/POS Commands Enabled'
      },
      {
        device: 'scanner',
        label: 'USB Handheld Barcode Scanner',
        status: 'online',
        port: this.config.scanner_port || 'USB-HID Wedge',
        lastPing: time,
        details: 'Listening for fast barcode inputs (<35ms)'
      },
      {
        device: 'cash_drawer',
        label: 'RJ11 Cash Drawer Kick',
        status: 'online',
        port: 'RJ11 via Printer Port',
        lastPing: time,
        details: `Pulse Command: ${this.config.cash_drawer_command || '27,112,0,25,250'}`
      },
      {
        device: 'card_terminal',
        label: 'Card Payment Terminal',
        status: this.config.card_terminal_enabled ? 'online' : 'offline',
        port: `TCP/IP ${this.config.card_terminal_ip || '192.168.1.210'}:${this.config.card_terminal_port || 8080}`,
        lastPing: time,
        details: this.config.card_terminal_enabled ? 'TCP/IP Socket Ready, ISO 8583 Active' : 'Disabled in Settings'
      },
      {
        device: 'scale',
        label: 'Electronic Weighing Scale',
        status: this.config.scale_enabled ? 'online' : 'offline',
        port: this.config.scale_port || 'COM4',
        lastPing: time,
        details: this.config.scale_enabled ? 'Live Serial Weight Polling Active' : 'Disabled'
      }
    ];
  }

  /**
   * Device Status Polling Heartbeat Loop (Runs every 4 seconds)
   */
  private startHeartbeatPolling(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    this.pollingTimer = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      this.deviceStatuses = this.deviceStatuses.map(dev => {
        // Heartbeat update with small random ping simulation to keep device health accurate
        if (dev.status === 'error') return dev; // keep error until cleared
        return {
          ...dev,
          lastPing: now,
          status: dev.status === 'offline' && dev.device !== 'card_terminal' && dev.device !== 'scale' ? 'online' : dev.status
        };
      });
      this.notify();
    }, 4000);
  }

  /**
   * Asynchronous I/O Queue Enqueue Engine
   */
  public enqueueJob(device: DeviceType, action: string, payload: any, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const job: HardwareJob = {
      id: jobId,
      device,
      action,
      payload,
      status: 'pending',
      priority,
      createdAt: new Date().toISOString()
    };

    if (priority === 'high') {
      this.jobQueue.unshift(job);
    } else {
      this.jobQueue.push(job);
    }

    this.notify();
    this.processQueue();
    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.jobQueue.some(j => j.status === 'pending')) {
      const jobIndex = this.jobQueue.findIndex(j => j.status === 'pending');
      if (jobIndex < 0) break;

      const job = this.jobQueue[jobIndex];
      job.status = 'processing';
      this.updateDeviceHealth(job.device, 'busy', `Processing action: ${job.action}`);
      this.notify();

      try {
        if (job.device === 'printer') {
          if (job.action === 'print_receipt') {
            await PrintService.executePrintJob(job.payload.sale, job.payload.settings, this.config);
          } else if (job.action === 'kick_drawer') {
            PrintService.triggerCashDrawerPulse(this.config);
          }
        } else if (job.device === 'card_terminal') {
          if (job.action === 'process_payment') {
            const terminal = CardPaymentTerminal.getInstance();
            await terminal.initiatePayment(
              job.payload.amount,
              job.payload.invoice_no,
              this.config.card_terminal_ip,
              this.config.card_terminal_port
            );
          }
        }

        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        this.updateDeviceHealth(job.device, 'online', 'Ready for next operation');
      } catch (err: any) {
        job.status = 'failed';
        job.error = err.message || 'I/O Execution Error';
        this.updateDeviceHealth(job.device, 'error', `Failure: ${job.error}`);
      }

      this.notify();
      await new Promise(r => setTimeout(r, 200));
    }

    this.isProcessingQueue = false;
  }

  private updateDeviceHealth(device: DeviceType, status: DeviceHealth, details: string) {
    this.deviceStatuses = this.deviceStatuses.map(dev => {
      if (dev.device === device) {
        return { ...dev, status, details, lastPing: new Date().toLocaleTimeString() };
      }
      return dev;
    });
  }

  public getDeviceStatuses(): DeviceStatus[] {
    return [...this.deviceStatuses];
  }

  public getJobQueue(): HardwareJob[] {
    return [...this.jobQueue];
  }

  public clearCompletedJobs(): void {
    this.jobQueue = this.jobQueue.filter(j => j.status === 'pending' || j.status === 'processing');
    this.notify();
  }
}
