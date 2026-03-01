// ===== SKELETON LOADING COMPONENTS =====

export function skeletonCard(count = 1) {
    return Array(count).fill('').map(() =>
        `<div class="glass-card" style="padding: var(--space-5);">
      <div class="skeleton skeleton-heading"></div>
      <div class="skeleton skeleton-text wide"></div>
      <div class="skeleton skeleton-text narrow"></div>
    </div>`
    ).join('');
}

export function skeletonStockCard(count = 8) {
    return Array(count).fill('').map(() =>
        `<div class="glass-card stock-card">
      <div class="stock-card__header">
        <div>
          <div class="skeleton" style="width:60px;height:18px;margin-bottom:4px;border-radius:4px;"></div>
          <div class="skeleton" style="width:100px;height:12px;border-radius:4px;"></div>
        </div>
        <div>
          <div class="skeleton" style="width:70px;height:18px;margin-bottom:4px;border-radius:4px;"></div>
          <div class="skeleton" style="width:50px;height:12px;margin-left:auto;border-radius:4px;"></div>
        </div>
      </div>
      <div class="skeleton" style="width:100%;height:40px;border-radius:4px;margin-top:8px;"></div>
    </div>`
    ).join('');
}

export function skeletonChart() {
    return `<div class="skeleton skeleton-chart"></div>`;
}

export function skeletonTable(rows = 8) {
    return Array(rows).fill('').map(() =>
        `<tr>
      <td><div class="skeleton" style="width:60px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:50px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:50px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:50px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:40px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:40px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:45px;height:14px;border-radius:3px;"></div></td>
      <td><div class="skeleton" style="width:40px;height:14px;border-radius:3px;"></div></td>
    </tr>`
    ).join('');
}

export function skeletonStrategyCard(count = 3) {
    return Array(count).fill('').map(() =>
        `<div class="glass-card" style="padding: var(--space-5);">
      <div class="flex justify-between items-center" style="margin-bottom:16px;">
        <div class="skeleton" style="width:140px;height:16px;border-radius:4px;"></div>
        <div class="skeleton" style="width:50px;height:16px;border-radius:4px;"></div>
      </div>
      <div class="skeleton" style="width:200px;height:12px;margin-bottom:16px;border-radius:4px;"></div>
      <div class="skeleton" style="width:100%;height:60px;margin-bottom:16px;border-radius:8px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="skeleton" style="height:14px;border-radius:4px;"></div>
        <div class="skeleton" style="height:14px;border-radius:4px;"></div>
        <div class="skeleton" style="height:14px;border-radius:4px;"></div>
        <div class="skeleton" style="height:14px;border-radius:4px;"></div>
      </div>
    </div>`
    ).join('');
}
