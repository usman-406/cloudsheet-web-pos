import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global safeguard against "TypeError: Converting circular structure to JSON"
// Prevents unhandled exceptions if DOM nodes or React Fiber trees are passed to serialization
const nativeStringify = JSON.stringify;
JSON.stringify = function (value: any, replacer?: any, space?: any) {
  try {
    return nativeStringify(value, replacer, space);
  } catch (err: any) {
    if (err instanceof TypeError && typeof err.message === 'string' && err.message.toLowerCase().includes('circular')) {
      const seen = new WeakSet();
      return nativeStringify(
        value,
        (key, val) => {
          if (typeof val === 'object' && val !== null) {
            if (typeof Node !== 'undefined' && val instanceof Node) {
              return `[DOMElement: ${val.nodeName}]`;
            }
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          if (typeof replacer === 'function') {
            return replacer(key, val);
          }
          return val;
        },
        space
      );
    }
    throw err;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
