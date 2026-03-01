// ===== TOAST NOTIFICATIONS =====

let container = null;

function ensureContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

const ICONS = {
    success: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

export function showToast(message, type = 'info', duration = 4000) {
    const c = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    ${ICONS[type] || ICONS.info}
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Dismiss">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

    toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));
    c.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => dismiss(toast), duration);
    }

    return toast;
}

function dismiss(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('dismissing');
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
}

export function showError(message) {
    return showToast(message, 'error', 6000);
}

export function showSuccess(message) {
    return showToast(message, 'success', 3000);
}
