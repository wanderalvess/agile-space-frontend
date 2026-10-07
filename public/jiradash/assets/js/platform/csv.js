// Export CSV: escape de célula, montagem e download.
//
// O U+FEFF no início do Blob é o BOM que o Excel exige para reconhecer UTF-8 e não
// quebrar a acentuação. Ele vive DENTRO do literal, não no início deste arquivo.

export const csv = {
  cell(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
    const str = value == null ? '' : String(value);
    return /[",;\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  },
  build(rows) {
    return rows.map(row => row.map(csv.cell).join(';')).join('\r\n');
  },
  download(filename, rows) {
    // BOM para o Excel reconhecer UTF-8 corretamente (acentuação).
    const blob = new Blob(['\uFEFF' + csv.build(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};
