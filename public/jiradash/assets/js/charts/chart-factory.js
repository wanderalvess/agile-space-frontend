// Fábrica de gráficos Chart.js: registro/destruição e as configurações reutilizáveis.
//
// `Chart` é o GLOBAL do CDN, carregado como script clássico no <head> antes deste módulo.
// Não há `import` de Chart.js, wrapper nem fallback — e nenhum `new Chart` acontece na
// AVALIAÇÃO deste arquivo, só dentro dos métodos, então a ordem das tags continua sendo a
// única garantia necessária.
//
// ⚠️ `doughnut` usa `this.percentagePlugin`: `this` é o objeto `chartFactory`, então não
// desmembre esses métodos nem os passe soltos como callback.
//
// `destroy` ESCREVE em `state.charts` (destrói a instância e apaga a chave) — é a única
// escrita em `state` que saiu do entrypoint até agora. O objeto `state.charts` é sempre o
// do singleton importado: não copie, substitua nem embrulhe.
//
// `doughnut`, `horizontalBar` e `percentagePlugin` estão sem consumidor hoje. Ficam de
// propósito: a remoção de código morto é decisão de outro ticket.
import { CONFIG } from '../core/config.js';
import { withAlpha } from '../core/helpers.js';
import { state } from '../core/state.js';
import { $ } from '../platform/dom.js';

export const chartFactory = {
  destroy(keys) {
    keys.forEach(key => {
      if (state.charts[key]) {
        state.charts[key].destroy();
        delete state.charts[key];
      }
    });
  },
  percentagePlugin: {
    id: 'pctLabel',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const total = chart.data.datasets[0].data.reduce((sum, value) => sum + value, 0);
      if (!total) return;

      chart.getDatasetMeta(0).data.forEach((arc, index) => {
        const value = chart.data.datasets[0].data[index];
        const pct = Math.round((value / total) * 100);
        if (pct < 5) return;

        const mid = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
        const radius = (arc.innerRadius + arc.outerRadius) / 2;

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px -apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, arc.x + Math.cos(mid) * radius, arc.y + Math.sin(mid) * radius);
        ctx.restore();
      });
    }
  },
  doughnut(canvasId, labels, data) {
    return new Chart($(canvasId), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CONFIG.chartPalette, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } } }
      },
      plugins: [this.percentagePlugin]
    });
  },
  horizontalBar(canvasId, labels, data, label = 'Issues') {
    return new Chart($(canvasId), {
      type: 'bar',
      data: { labels, datasets: [{ label, data, backgroundColor: CONFIG.colors.info, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { font: { size: 11 } } } }
      }
    });
  },
  burndown(canvasId, labels, ideal, actual, actualColor, yLabel) {
    return new Chart($(canvasId), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ideal',
            data: ideal,
            borderColor: CONFIG.colors.light,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
            fill: false
          },
          {
            label: 'Real',
            data: actual,
            borderColor: actualColor,
            backgroundColor: withAlpha(actualColor, 0.08),
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: actualColor,
            tension: 0.1,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        spanGaps: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 } },
          y: {
            beginAtZero: true,
            ticks: { font: { size: 11 } },
            title: { display: true, text: yLabel, font: { size: 11 }, color: CONFIG.colors.muted }
          }
        }
      }
    });
  },
  burnup(canvasId, labels, total, done, yLabel) {
    return new Chart($(canvasId), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Escopo total',
            data: total,
            borderColor: CONFIG.colors.muted,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: CONFIG.colors.muted,
            stepped: true,
            tension: 0,
            fill: false
          },
          {
            label: 'Concluído',
            data: done,
            borderColor: CONFIG.colors.success,
            backgroundColor: withAlpha(CONFIG.colors.success, 0.12),
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: CONFIG.colors.success,
            tension: 0.1,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        spanGaps: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 } },
          y: {
            beginAtZero: true,
            ticks: { font: { size: 11 } },
            title: { display: true, text: yLabel, font: { size: 11 }, color: CONFIG.colors.muted }
          }
        }
      }
    });
  },
  barLabelPlugin: {
    id: 'barLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      chart.data.datasets.forEach((ds, i) => {
        chart.getDatasetMeta(i).data.forEach((bar, j) => {
          const val = ds.data[j];
          if (!val) return;
          const barH = Math.abs(bar.base - bar.y);
          if (barH < 16) return;
          // ⚠️ Formatação POR DATASET. O default é o de sempre — uma casa —, e vale para worklog
          // e estimativa. Datasets de CAPACITY passam `valueFormatter` (duas casas): com o default,
          // uma capacity de 35.84h era desenhada como "35.8" e divergia da tabela.
          const txt =
            typeof ds.valueFormatter === 'function'
              ? ds.valueFormatter(val)
              : val % 1 === 0
                ? String(val)
                : val.toFixed(1);
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px -apple-system,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, bar.x, bar.y + barH * 0.38);
          ctx.restore();
        });
      });
    }
  },
  barChartOpts(yLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } } },
      scales: {
        x: { ticks: { font: { size: 11 } } },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11 }, callback: v => `${v}h` },
          title: { display: true, text: yLabel, font: { size: 11 }, color: CONFIG.colors.muted }
        }
      }
    };
  }
};
