/**
 * Global Custom Form Validation Tooltip System
 * Replaces default ugly OS/browser "Please fill out this field" popup
 * with a futuristic, glassmorphic floating tooltip with glowing icon and smooth animations.
 */

let activeTooltip = null;
let activeTarget = null;
let dismissTimer = null;

function removeTooltip() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  if (activeTarget) {
    activeTarget.classList.remove('custom-input-invalid-shake');
    activeTarget = null;
  }

  if (activeTooltip) {
    const el = activeTooltip;
    el.classList.add('closing');
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 200);
    activeTooltip = null;
  }
}

function positionTooltip(tooltip, target) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;

  // Prefer placing below the input, unless close to the bottom of the viewport
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeTop = spaceBelow < 60 && rect.top > tooltipRect.height + 20;

  let top, left;

  if (placeTop) {
    top = rect.top + scrollY - tooltipRect.height - 10;
    tooltip.classList.add('placement-top');
  } else {
    top = rect.bottom + scrollY + 10;
    tooltip.classList.remove('placement-top');
  }

  // Align horizontally with input, keeping inside viewport padding
  left = rect.left + scrollX + 12;
  const maxLeft = scrollX + window.innerWidth - tooltipRect.width - 16;
  if (left > maxLeft) {
    left = Math.max(scrollX + 16, maxLeft);
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

export function showCustomValidationTooltip(target, customMessage) {
  removeTooltip();

  if (!target || typeof target.getBoundingClientRect !== 'function') return;

  activeTarget = target;
  target.classList.add('custom-input-invalid-shake');
  
  try {
    target.focus({ preventScroll: false });
  } catch {
    // Ignore focus issues if any
  }

  const message = customMessage || target.validationMessage || 'Please fill out this field.';

  // Create tooltip DOM
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-validation-tooltip';
  tooltip.setAttribute('role', 'alert');
  tooltip.setAttribute('aria-live', 'assertive');

  tooltip.innerHTML = `
    <div class="custom-validation-caret"></div>
    <div class="custom-validation-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <span class="custom-validation-msg">${message}</span>
  `;

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  positionTooltip(tooltip, target);

  // Auto-dismiss on interaction
  const dismissOnAction = () => {
    removeTooltip();
    target.removeEventListener('input', dismissOnAction);
    target.removeEventListener('change', dismissOnAction);
    target.removeEventListener('keydown', dismissOnAction);
    window.removeEventListener('click', dismissOnClickOutside);
    window.removeEventListener('scroll', updatePosition);
    window.removeEventListener('resize', updatePosition);
  };

  const dismissOnClickOutside = (e) => {
    if (!tooltip.contains(e.target) && e.target !== target) {
      dismissOnAction();
    }
  };

  const updatePosition = () => {
    if (activeTooltip && activeTarget) {
      positionTooltip(activeTooltip, activeTarget);
    }
  };

  target.addEventListener('input', dismissOnAction, { once: true });
  target.addEventListener('change', dismissOnAction, { once: true });
  target.addEventListener('keydown', dismissOnAction, { once: true });
  setTimeout(() => {
    window.addEventListener('click', dismissOnClickOutside);
  }, 50);
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition, { passive: true });

  // Auto-dismiss after 4.5 seconds
  dismissTimer = setTimeout(dismissOnAction, 4500);
}

/**
 * Initializes the global listener to intercept native browser invalid events.
 */
export function initCustomValidation() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  document.addEventListener(
    'invalid',
    (e) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        // Prevent ugly native browser popup
        e.preventDefault();
        showCustomValidationTooltip(target);
      }
    },
    true // Capture phase to intercept before native UI triggers
  );
}
