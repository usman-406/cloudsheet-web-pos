import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  ExternalLink, 
  Database, 
  Printer, 
  QrCode, 
  Key, 
  Layers, 
  CheckCircle2
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/gasCode';

interface GASGuideModalProps {
  onClose?: () => void;
}

export const GASGuideModal: React.FC<GASGuideModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'instructions' | 'hardware'>('script');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-[#0f6cbd] text-white p-6 rounded-lg shadow-xs relative overflow-hidden font-sans">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1.5 bg-white/20 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Google Sheets + Apps Script Integration
          </div>
          <h2 className="text-2xl font-bold">Google Apps Script & Hardware Integration Guide</h2>
          <p className="text-xs text-blue-100 max-w-2xl">
            Complete backend script and deployment instructions to automatically link BoomandCarry POS with your Google Sheet database.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('script')}
          className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'script'
              ? 'border-[#0b5fa5] text-[#0b5fa5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>1. Complete Code.gs Script</span>
        </button>

        <button
          onClick={() => setActiveTab('instructions')}
          className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'instructions'
              ? 'border-[#0b5fa5] text-[#0b5fa5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>2. Google Sheets Deployment Steps</span>
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`py-2.5 px-4 border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'hardware'
              ? 'border-[#0b5fa5] text-[#0b5fa5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>3. Printer & USB Scanner Setup</span>
        </button>
      </div>

      {/* TAB 1: CODE.GS VIEW */}
      {activeTab === 'script' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Google Apps Script (Code.gs) Source Code</h3>
              <p className="text-xs text-slate-500">Copy this complete script and paste it into Google Apps Script editor</p>
            </div>

            <button
              onClick={handleCopyCode}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow transition flex items-center justify-center space-x-1.5 ${
                copied ? 'bg-emerald-600 text-white' : 'bg-[#0b5fa5] hover:bg-[#094e88] text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : '1-Click Copy Code.gs'}</span>
            </button>
          </div>

          <div className="relative bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-[500px] leading-relaxed select-text">
            <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
          </div>
        </div>
      )}

      {/* TAB 2: INSTRUCTIONS */}
      {activeTab === 'instructions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs text-slate-700">
          
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#0b5fa5] text-white flex items-center justify-center font-bold text-xs">1</span>
              <span>Create Google Sheet & Open Apps Script Editor</span>
            </h3>
            <ul className="list-disc pl-8 space-y-1.5 text-slate-600">
              <li>Open <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-[#0b5fa5] font-bold underline">Google Sheets</a> and create a new blank spreadsheet (e.g. named <strong>"POS System Database"</strong>).</li>
              <li>Go to the top menu bar: Click <strong>Extensions → Apps Script</strong>.</li>
              <li>A new Google Apps Script tab will open with a default <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Code.gs</code> file.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#0b5fa5] text-white flex items-center justify-center font-bold text-xs">2</span>
              <span>Paste Code.gs & Save</span>
            </h3>
            <ul className="list-disc pl-8 space-y-1.5 text-slate-600">
              <li>Delete all pre-existing placeholder code in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Code.gs</code>.</li>
              <li>Click the <strong>1-Click Copy Code.gs</strong> button on Tab 1 of this guide, then paste the full code into the editor.</li>
              <li>Click the disk icon or press <kbd className="bg-slate-100 px-1 rounded font-mono">Ctrl + S</kbd> to save.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#0b5fa5] text-white flex items-center justify-center font-bold text-xs">3</span>
              <span>Deploy as Web App (CRITICAL SETTINGS)</span>
            </h3>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-2">
              <p className="font-bold text-blue-900">Follow these exact Deployment Settings:</p>
              <ol className="list-decimal pl-5 space-y-1 text-blue-950 font-medium">
                <li>Click the blue <strong>Deploy</strong> button (top right) → Select <strong>New deployment</strong>.</li>
                <li>Click the gear icon next to "Select type" → Choose <strong>Web App</strong>.</li>
                <li><strong>Description:</strong> Type <code className="bg-white px-1 rounded font-mono">POS API v1</code>.</li>
                <li><strong>Execute as:</strong> Choose <strong>Me (your email)</strong>.</li>
                <li><strong>Who has access:</strong> Choose <strong>Anyone</strong> (REQUIRED for web app requests without login blocks).</li>
                <li>Click <strong>Deploy</strong>.</li>
                <li>Grant required permissions when prompted by Google (Click Advanced → Proceed to POS Backend).</li>
                <li>Copy the generated <strong>Web App URL</strong> ending in <code className="bg-white px-1 rounded font-mono">/exec</code>.</li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#0b5fa5] text-white flex items-center justify-center font-bold text-xs">4</span>
              <span>Link URL to POS Settings</span>
            </h3>
            <ul className="list-disc pl-8 space-y-1.5 text-slate-600">
              <li>In this POS application, navigate to <strong>Settings</strong>.</li>
              <li>Paste your copied URL into the <strong>Google Apps Script Web App URL</strong> field.</li>
              <li>Click <strong>Test Connection</strong>. You will receive a green confirmation badge!</li>
              <li>The 5 required tabs (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Products, Sales, Customers, Expenses, Settings</code>) and Google Drive <strong>"Invoices"</strong> folder will be auto-created automatically!</li>
            </ul>
          </div>

        </div>
      )}

      {/* TAB 3: HARDWARE SETUP */}
      {activeTab === 'hardware' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs text-slate-700">
          
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Printer className="w-4 h-4 text-[#0b5fa5]" />
              <span>Thermal Receipt Printer Setup (80mm / 58mm)</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              This POS system natively generates formatted thermal receipts matching standard 80mm ESC/POS paper dimensions.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Connect your thermal printer via USB or Bluetooth driver to your operating system.</li>
              <li>In your OS print settings or browser print dialog, set paper size to <strong>80mm x 297mm</strong> or <strong>Roll Paper 80mm</strong>.</li>
              <li>Set <strong>Margins: None</strong> in browser print options for clean thermal layout without header/footer margins.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-[#0b5fa5]" />
              <span>USB Barcode Scanner Setup</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              All standard USB Handheld Barcode Scanners (Honeywell, Zebra, Eyoyo, Datalogic) work out of the box without installing drivers.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Plug scanner into any USB port.</li>
              <li>The POS scanner engine continuously listens for barcode input. Simply scan any item product barcode while on the <strong>POS Billing</strong> page to instantly add items to the cart!</li>
              <li>Press <kbd className="bg-slate-100 px-1 rounded font-mono">F2</kbd> anytime to jump search focus to barcode/product search.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Key className="w-4 h-4 text-[#0b5fa5]" />
              <span>Cash Drawer Integration</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Connect your cash drawer RJ11 cable directly into the back port of your POS Thermal Printer. When the printer receives a print or kick signal, it automatically sends the standard 24V pulse to trigger the drawer open.
            </p>
          </div>

        </div>
      )}

    </div>
  );
};
