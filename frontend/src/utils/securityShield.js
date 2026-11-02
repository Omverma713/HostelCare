/**
 * HostelCare Client Anti-Inspect & DevTools Shield
 * 
 * Protects production web client against casual inspection, source snooping,
 * right-click saving, and unauthorized console tampering.
 * 
 * Automatically disabled during local development (import.meta.env.DEV)
 * to maintain developer productivity.
 */
export function initSecurityShield() {
  // Only activate in production environments
  if (!import.meta.env.PROD) {
    return;
  }

  // 1. Right-Click Prevention (except inside form inputs/textareas)
  document.addEventListener(
    'contextmenu',
    (e) => {
      const targetTag = e.target?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
        return; // Allow copy-paste inside text boxes
      }
      e.preventDefault();
    },
    false
  );

  // 2. Keyboard Shortcuts Block (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
  document.addEventListener(
    'keydown',
    (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = (e.key || '').toUpperCase();

      // F12 key
      if (e.keyCode === 123 || key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element Picker)
      if (isCtrlOrMeta && isShift && ['I', 'J', 'C'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U (View Source)
      if (isCtrlOrMeta && key === 'U') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S (Save Page)
      if (isCtrlOrMeta && key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    false
  );

  // 3. Console Warning Banner
  try {
    const bannerTitle = 'color: #ff3333; font-size: 28px; font-weight: 900; font-family: monospace;';
    const bannerText = 'color: #cbd5e1; font-size: 13px; font-family: sans-serif; line-height: 1.5;';
    console.log('%c⛔ HOSTELCARE SECURITY SHIELD', bannerTitle);
    console.log(
      '%cUnauthorized inspection, script injection, or source tampering is strictly prohibited.\nAll security events and sessions are logged.',
      bannerText
    );
  } catch (_) {}

  // 4. Debugger Pause Trap if DevTools is Docked/Opened
  try {
    let checkTrap = () => {
      const threshold = 160;
      const widthExceeded = window.outerWidth - window.innerWidth > threshold;
      const heightExceeded = window.outerHeight - window.innerHeight > threshold;
      if (widthExceeded || heightExceeded) {
        (function () {
          Function('debugger')();
        })();
      }
    };
    setInterval(checkTrap, 1200);
  } catch (_) {}
}
