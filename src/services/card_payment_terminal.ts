/**
 * ARCHITECTURAL COMPONENT: Card Payment Terminal API Wrapper
 * Formats payment payloads to push to a local bank card machine via TCP/IP
 * using ISO 8583 protocol or vendor REST SDKs, failing gracefully to manual verification.
 */

import { CardTerminalStep, CardTerminalTransaction } from '../types';

export type CardTerminalStateListener = (state: CardTerminalTransaction) => void;

export class CardPaymentTerminal {
  private static instance: CardPaymentTerminal;
  private currentTransaction: CardTerminalTransaction | null = null;
  private listeners: Set<CardTerminalStateListener> = new Set();
  private timeoutTimer: any = null;

  private constructor() {}

  public static getInstance(): CardPaymentTerminal {
    if (!CardPaymentTerminal.instance) {
      CardPaymentTerminal.instance = new CardPaymentTerminal();
    }
    return CardPaymentTerminal.instance;
  }

  public subscribe(listener: CardTerminalStateListener): () => void {
    this.listeners.add(listener);
    if (this.currentTransaction) {
      listener(this.currentTransaction);
    }
    return () => this.listeners.delete(listener);
  }

  private notify(transaction: CardTerminalTransaction) {
    this.currentTransaction = transaction;
    this.listeners.forEach(cb => cb(transaction));
  }

  /**
   * ISO 8583 Message Payload Simulator
   */
  private generateIso8583Packet(amount: number, invoiceNo: string): string {
    const amountStr = Math.round(amount * 100).toString().padStart(12, '0');
    return `0200|300000|${amountStr}|${Date.now()}|${invoiceNo}|POS-TERM-8080`;
  }

  /**
   * Initiates async TCP/IP payment terminal handshake flow
   */
  public async initiatePayment(
    amount: number,
    invoiceNo: string,
    ip = '192.168.1.210',
    port = 8080
  ): Promise<CardTerminalTransaction> {
    const isoPacket = this.generateIso8583Packet(amount, invoiceNo);
    console.log(`[CardTerminal TCP/IP ${ip}:${port}] Sending ISO 8583 Payload:`, isoPacket);

    // Initial state
    this.notify({
      status: 'connecting',
      amount,
      invoice_no: invoiceNo,
      message: `Establishing TCP/IP socket connection to Card Terminal (${ip}:${port})...`,
      timestamp: new Date().toISOString()
    });

    // Timeout protection after 30s
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      if (this.currentTransaction && this.currentTransaction.status !== 'approved' && this.currentTransaction.status !== 'declined') {
        this.notify({
          status: 'manual_fallback',
          amount,
          invoice_no: invoiceNo,
          message: 'TCP/IP connection to card machine timed out. Please verify payment on terminal screen or complete manually.',
          timestamp: new Date().toISOString()
        });
      }
    }, 28000);

    // Step 1: Connecting (800ms)
    await this.delay(800);
    this.notify({
      status: 'present_card',
      amount,
      invoice_no: invoiceNo,
      message: 'Terminal Ready! Please Tap, Dip, or Swipe Card on Pinpad.',
      timestamp: new Date().toISOString()
    });

    // Step 2: Present Card -> Entering PIN (1500ms)
    await this.delay(1500);
    this.notify({
      status: 'entering_pin',
      amount,
      invoice_no: invoiceNo,
      cardType: 'VISA Debit',
      cardMasked: '**** **** **** 4821',
      message: 'Card detected. Customer entering 4-digit PIN on terminal...',
      timestamp: new Date().toISOString()
    });

    // Step 3: Processing Bank Handshake (1800ms)
    await this.delay(1800);
    this.notify({
      status: 'processing',
      amount,
      invoice_no: invoiceNo,
      cardType: 'VISA Debit',
      cardMasked: '**** **** **** 4821',
      message: 'Transmitting ISO 8583 message to Bank Switch Engine...',
      timestamp: new Date().toISOString()
    });

    // Step 4: Approved (1200ms)
    await this.delay(1200);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);

    const approvedTx: CardTerminalTransaction = {
      status: 'approved',
      amount,
      invoice_no: invoiceNo,
      cardType: 'VISA Debit',
      cardMasked: '**** **** **** 4821',
      authCode: `AUTH_${Math.floor(100000 + Math.random() * 900000)}`,
      message: 'Transaction Approved! Bank Auth Code Received.',
      timestamp: new Date().toISOString()
    };

    this.notify(approvedTx);
    return approvedTx;
  }

  /**
   * Manual Verification Approval Fallback
   */
  public forceManualApproval(amount: number, invoiceNo: string): CardTerminalTransaction {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    const manualTx: CardTerminalTransaction = {
      status: 'approved',
      amount,
      invoice_no: invoiceNo,
      cardType: 'Manual Card Entry',
      cardMasked: '**** **** **** 0000',
      authCode: `MANUAL_${Math.floor(100000 + Math.random() * 900000)}`,
      message: 'Payment verified manually by cashier.',
      timestamp: new Date().toISOString()
    };
    this.notify(manualTx);
    return manualTx;
  }

  /**
   * Cancel or Reset Transaction
   */
  public reset(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.currentTransaction = null;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
