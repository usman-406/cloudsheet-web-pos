import React, { useState, useEffect } from 'react';
import { 
  SlidersHorizontal, 
  Printer, 
  Barcode, 
  CreditCard, 
  Scale, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Play, 
  Trash2, 
  Key, 
  Settings,
  Zap,
  Terminal,
  Usb,
  FileText,
  Info
} from 'lucide-react';
import { HardwareManager } from '../services/hardwareManager';
import { PrintService } from '../services/print_service';
import { BarcodeController } from '../services/barcode_controller';
import { CardPaymentTerminal } from '../services/card_payment_terminal';
import { DeviceStatus, HardwareJob, HardwareConfig, ShopSettings } from '../types';

interface HardwareDiagnosticsModalProps {
  settings: ShopSettings;
  onClose: () => void;
}

export const HardwareDiagnosticsModal: React.FC<HardwareDiagnosticsModalProps> = ({
  settings,
  onClose,
}) => {
  const hw = HardwareManager.getInstance();
  const [statuses, setStatuses] = useState<DeviceStatus[]>(hw.getDeviceStatuses());
  const [jobs, setJobs] = useState<HardwareJob[]>(hw.getJobQueue());
  const [config, setConfig] = useState<HardwareConfig>(hw.getConfig());
  const [activeTab, setActiveTab] = useState<'devices' | 'config' | 'queue' | 'help'>('devices');
  const [testOutput, setTestOutput] = useState<string>('Ready for POS-80 hardware diagnostics...');
  const [scannedTestCode, setScannedTestCode] = useState<string>('');
  const [pairedUsbName, setPairedUsbName] = useState<string | null>(PrintService.getPairedUsbDeviceName());

  useEffect(() => {
    const unsubscribe = hw.subscribe((newStatuses, newJobs) => {
      setStatuses(newStatuses);
      setJobs(newJobs);
    });

    // Register test scanner listener
    const barcodeService = BarcodeController.getInstance();
    const unsubBarcode = barcodeService.registerCallback((code) => {
      setScannedTestCode(code);
      setTestOutput(`[SCANNED CODE] Read Barcode: ${code} at ${new Date().toLocaleTimeString()}`);
    });

    return () => {
      unsubscribe();
      unsubBarcode();
    };
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    hw.saveConfig(config);
    setTestOutput('✅ Hardware configuration saved successfully!');
  };

  const handleTestPrint = () => {
    setTestOutput('Executing POS-80 80mm Thermal Printer Test Job...');
    hw.enqueueJob('printer', 'print_receipt', {
      sale: {
        id: 'test_sale_1',
        invoice_no: 'TEST-POS80-001',
        datetime: new Date().toISOString(),
        customer_name: 'POS-80 Diagnostics Customer',
        customer_phone: '0300-1234567',
        subtotal: 1000,
        tax_rate: 16,
        tax_amount: 160,
        discount: 50,
        total: 1110,
        paid: 1200,
        change_due: 90,
        payment_method: 'Cash',
        cashier_name: 'Admin Hardware Diagnostics',
        status: 'completed',
        items: [
          { product_id: 'test_1', barcode: '890123456701', name: 'POS-80 80mm Thermal Test Product', quantity: 2, buy_price: 250, sell_price: 500, discount: 50, total: 950 }
        ]
      },
      settings
    }, 'high');
  };

  const handlePairUsbPrinter = async () => {
    setTestOutput('Opening WebUSB device picker for POS-80 Thermal Printer...');
    const res = await PrintService.pairUsbPrinter();
    setTestOutput(res.message);
    setPairedUsbName(PrintService.getPairedUsbDeviceName());
  };

  const handlePairSerialPrinter = async () => {
    setTestOutput('Opening WebSerial COM port picker for POS-80 Thermal Printer...');
    const res = await PrintService.pairSerialPrinter(config.baud_rate || 9600);
    setTestOutput(res.message);
  };

  const handleTestDrawer = () => {
    setTestOutput('Firing 24V RJ11 Cash Drawer Kick Out Command (27, 112, 0, 25, 250)...');
    hw.enqueueJob('printer', 'kick_drawer', {}, 'high');
  };

  const handleTestCardTerminal = async () => {
    setTestOutput('Initiating TCP/IP Socket Handshake with Card Payment Terminal...');
    hw.enqueueJob('card_terminal', 'process_payment', {
      amount: 1500,
      invoice_no: `TERM-TEST-${Date.now().toString().slice(-4)}`
    }, 'high');
  };

  const handleConnectSerialScanner = async () => {
    setTestOutput('Opening WebSerial COM port picker for barcode reader...');
    const res = await BarcodeController.getInstance().connectSerialScanner(config.baud_rate);
    setTestOutput(res.message);
  };

  const handleClearJobs = () => {
    hw.clearCompletedJobs();
    setTestOutput('Cleared completed hardware I/O queue items.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] my-auto flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0b5fa5] text-white flex items-center justify-center font-bold">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black">Hardware Controller & Diagnostics Panel</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">POS-80 Ready</span>
              </div>
              <p className="text-xs text-slate-400">POS-80 Thermal Printer (Width: 80mm | Connection: USB), Barcode Scanner, Cash Drawer & Card POS</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition cursor-pointer ${
              activeTab === 'devices'
                ? 'border-[#0b5fa5] text-[#0b5fa5] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Connected Devices ({statuses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition cursor-pointer ${
              activeTab === 'config'
                ? 'border-[#0b5fa5] text-[#0b5fa5] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Printer & Driver Config</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition cursor-pointer ${
              activeTab === 'queue'
                ? 'border-[#0b5fa5] text-[#0b5fa5] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Async I/O Queue ({jobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition cursor-pointer ${
              activeTab === 'help'
                ? 'border-[#0b5fa5] text-[#0b5fa5] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>80mm Setup Guide</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 text-xs">
          
          {/* TAB 1: CONNECTED DEVICES & DIRECT TESTS */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              
              {/* POS-80 Featured Card */}
              <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-5 rounded-2xl border border-blue-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-[#0b5fa5] text-white rounded-xl">
                      <Printer className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold flex items-center space-x-2">
                        <span>POS-80 Thermal Receipt Printer</span>
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">ACTIVE</span>
                      </h4>
                      <p className="text-xs text-blue-200">
                        Paper Width: <strong>80mm</strong> | Connection: <strong>USB (WebUSB / WebSerial / System Driver)</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePairUsbPrinter}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Usb className="w-4 h-4" />
                      <span>{pairedUsbName ? `Paired: ${pairedUsbName}` : 'Pair USB Printer'}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handlePairSerialPrinter}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <span>Pair Serial COM</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono text-slate-300 border-t border-slate-700/80">
                  <div>Paper Standard: <span className="text-white font-bold">80mm Roll</span></div>
                  <div>Columns: <span className="text-white font-bold">48 (Font A)</span></div>
                  <div>ESC/POS Protocol: <span className="text-white font-bold">Supported</span></div>
                  <div>Auto Paper Cutter: <span className="text-white font-bold">Active</span></div>
                </div>
              </div>

              {/* Status Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {statuses.map((dev) => (
                  <div key={dev.device} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 font-bold">
                          {dev.device === 'printer' && <Printer className="w-4 h-4" />}
                          {dev.device === 'scanner' && <Barcode className="w-4 h-4" />}
                          {dev.device === 'cash_drawer' && <Key className="w-4 h-4" />}
                          {dev.device === 'card_terminal' && <CreditCard className="w-4 h-4" />}
                          {dev.device === 'scale' && <Scale className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">{dev.label}</h4>
                          <span className="text-[11px] font-mono text-slate-500">{dev.port}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        dev.status === 'online' ? 'bg-emerald-100 text-emerald-800' :
                        dev.status === 'busy' ? 'bg-amber-100 text-amber-900 animate-pulse' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {dev.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      {dev.details}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Last Ping: {dev.lastPing}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Direct Test Execution Buttons */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                  <Play className="w-4 h-4 text-[#0b5fa5]" />
                  <span>Manual Hardware Test Suite</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={handleTestPrint}
                    className="p-3 bg-blue-50 hover:bg-blue-100 text-[#0b5fa5] font-bold rounded-xl border border-blue-200 text-xs transition flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                  >
                    <Printer className="w-5 h-5 text-[#0b5fa5]" />
                    <span>Test 80mm Receipt Print</span>
                  </button>

                  <button
                    onClick={handleTestDrawer}
                    className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl border border-amber-200 text-xs transition flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                  >
                    <Key className="w-5 h-5 text-amber-700" />
                    <span>Kick RJ11 Cash Drawer</span>
                  </button>

                  <button
                    onClick={handleTestCardTerminal}
                    className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold rounded-xl border border-indigo-200 text-xs transition flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-5 h-5 text-indigo-700" />
                    <span>Test Card Machine Socket</span>
                  </button>

                  <button
                    onClick={handleConnectSerialScanner}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-xl border border-emerald-200 text-xs transition flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                  >
                    <Barcode className="w-5 h-5 text-emerald-700" />
                    <span>Connect WebSerial Scanner</span>
                  </button>
                </div>

                {scannedTestCode && (
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 font-mono text-xs font-bold flex items-center justify-between">
                    <span>Scanned Test Barcode:</span>
                    <span className="bg-white px-2.5 py-1 rounded border border-emerald-300">{scannedTestCode}</span>
                  </div>
                )}
              </div>

              {/* Console Output Log Box */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-1 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold border-b border-slate-800 pb-1 flex justify-between">
                  <span>Hardware Controller Log Output</span>
                  <span className="text-emerald-400 font-bold">READY</span>
                </div>
                <div className="pt-1 text-slate-300 whitespace-pre-wrap">{testOutput}</div>
              </div>

            </div>
          )}

          {/* TAB 2: HARDWARE DRIVER CONFIGURATION */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thermal Printer Model</label>
                  <input
                    type="text"
                    value={config.printer_name || 'POS-80 Thermal Printer'}
                    onChange={(e) => setConfig({ ...config, printer_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thermal Printer Paper Width</label>
                  <select
                    value={config.paper_width || '80mm'}
                    onChange={(e) => setConfig({ ...config, paper_width: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="80mm">80mm Paper Width (Standard POS-80 Roll / 48 columns)</option>
                    <option value="58mm">58mm Compact Receipt Paper (32 columns)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thermal Printer Connection Mode</label>
                  <select
                    value={config.printer_connection}
                    onChange={(e) => setConfig({ ...config, printer_connection: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="usb">USB Direct ESC/POS (POS-80 USB Bridge)</option>
                    <option value="serial">Serial / WebSerial COM Port (USB-UART)</option>
                    <option value="network">TCP/IP Network Printer (Ethernet/LAN)</option>
                    <option value="browser">Browser Native Print Driver (80mm)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Printer Port Mapping</label>
                  <input
                    type="text"
                    value={config.printer_port}
                    onChange={(e) => setConfig({ ...config, printer_port: e.target.value })}
                    placeholder="USB (POS-80 / 80mm Thermal)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Serial Baud Rate</label>
                  <select
                    value={config.baud_rate}
                    onChange={(e) => setConfig({ ...config, baud_rate: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value={9600}>9600 Baud (Standard POS-80)</option>
                    <option value={19200}>19200 Baud</option>
                    <option value={38400}>38400 Baud</option>
                    <option value={115200}>115200 Baud (Fast USB Serial)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">RJ11 Cash Drawer Pulse Command (ESC p)</label>
                  <input
                    type="text"
                    value={config.cash_drawer_command}
                    onChange={(e) => setConfig({ ...config, cash_drawer_command: e.target.value })}
                    placeholder="27,112,0,25,250"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Card Payment Terminal IP Address</label>
                  <input
                    type="text"
                    value={config.card_terminal_ip}
                    onChange={(e) => setConfig({ ...config, card_terminal_ip: e.target.value })}
                    placeholder="192.168.1.210"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Card Terminal TCP Port</label>
                  <input
                    type="number"
                    value={config.card_terminal_port}
                    onChange={(e) => setConfig({ ...config, card_terminal_port: Number(e.target.value) })}
                    placeholder="8080"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-extrabold rounded-xl shadow-md text-xs transition cursor-pointer"
              >
                Save Hardware Driver Configuration
              </button>
            </form>
          )}

          {/* TAB 3: ASYNC I/O QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Async Hardware Event Queue</span>
                <button
                  onClick={handleClearJobs}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Completed</span>
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  No pending or active hardware jobs in the queue.
                </div>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-800 uppercase text-[11px]">{job.device}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{job.action}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            job.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {job.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Job ID: {job.id} | Created: {new Date(job.createdAt).toLocaleTimeString()}</p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        job.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        job.status === 'processing' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 80MM SETUP GUIDE */}
          {activeTab === 'help' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <h4 className="font-bold text-[#0b5fa5] text-sm">POS-80 Thermal Printer (80mm USB) Setup</h4>
                <p>
                  Your POS system is pre-calibrated for standard <strong>80mm thermal receipt rolls</strong> (72mm-76mm active printable width, 48 characters per line).
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-slate-900">Recommended Browser Print Settings (for USB Driver Mode):</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Destination / Printer:</strong> Select your POS-80 / Thermal Receipt Printer (e.g. <code>POS-80</code>, <code>Xprinter 80mm</code>, <code>Epson TM-T88</code>).</li>
                  <li><strong>Paper Size:</strong> <code>80 x 297 mm</code> or <code>Roll Paper 80 x 3276 mm</code>.</li>
                  <li><strong>Margins:</strong> Set to <code>None</code> (crucial for exact 80mm edge alignment).</li>
                  <li><strong>Scale:</strong> Set to <code>100%</code> or <code>Default</code>.</li>
                  <li><strong>Headers and Footers:</strong> Uncheck (prevents browser date/URL headers from printing).</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2">
                <h5 className="font-bold text-slate-900">Direct WebUSB Mode (Zero-Dialog Printing):</h5>
                <p>
                  Click <strong>Pair USB Printer</strong> in the Devices tab to pair the POS-80 USB cable directly with the browser. Once paired, receipts stream directly over USB without opening the browser print dialog.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
