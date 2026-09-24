const PDFDocument = require('pdfkit');

function generateInvoicePdf({ user, client, invoice, items }, res) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `${invoice.type}-${invoice.invoice_number}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const title = invoice.type === 'estimate' ? 'ESTIMATE' : 'INVOICE';

  // Header
  doc.fontSize(20).text(user.business_name || 'Your Business', { continued: false });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#555')
    .text(user.address || '')
    .text(user.phone || '')
    .text(user.email || '');
  doc.fillColor('#000');

  doc.moveUp(4);
  doc.fontSize(24).fillColor('#2b6cb0').text(title, { align: 'right' });
  doc.fillColor('#000').fontSize(10)
    .text(`# ${invoice.invoice_number}`, { align: 'right' })
    .text(`Issue date: ${invoice.issue_date}`, { align: 'right' })
    .text(invoice.due_date ? `Due date: ${invoice.due_date}` : '', { align: 'right' });

  doc.moveDown(2);

  // Bill to
  doc.fontSize(12).text('Bill To:', { underline: true });
  doc.fontSize(11)
    .text(client.name)
    .text(client.email || '')
    .text(client.address || '');

  doc.moveDown(1.5);

  // Table header
  const tableTop = doc.y;
  const col = { desc: 50, qty: 300, price: 370, amount: 460 };
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Description', col.desc, tableTop);
  doc.text('Qty', col.qty, tableTop);
  doc.text('Unit Price', col.price, tableTop);
  doc.text('Amount', col.amount, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
  doc.font('Helvetica').fontSize(10);

  let y = tableTop + 22;
  const currency = user.currency || 'USD';
  const fmt = (n) => `${currency} ${Number(n).toFixed(2)}`;

  items.forEach((item) => {
    doc.text(item.description, col.desc, y, { width: 240 });
    doc.text(String(item.quantity), col.qty, y);
    doc.text(fmt(item.unit_price), col.price, y);
    doc.text(fmt(item.amount), col.amount, y);
    y += 20;
  });

  doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();
  y += 15;

  doc.text('Subtotal:', col.price, y);
  doc.text(fmt(invoice.subtotal), col.amount, y);
  y += 18;

  if (invoice.discount) {
    doc.text('Discount:', col.price, y);
    doc.text(fmt(invoice.discount), col.amount, y);
    y += 18;
  }

  if (invoice.tax_rate) {
    doc.text(`Tax (${invoice.tax_rate}%):`, col.price, y);
    doc.text(fmt(invoice.tax_amount), col.amount, y);
    y += 18;
  }

  doc.font('Helvetica-Bold');
  doc.text('Total:', col.price, y);
  doc.text(fmt(invoice.total), col.amount, y);
  doc.font('Helvetica');
  y += 18;

  if (invoice.amount_paid) {
    doc.text('Amount Paid:', col.price, y);
    doc.text(fmt(invoice.amount_paid), col.amount, y);
    y += 18;
    doc.font('Helvetica-Bold');
    doc.text('Balance Due:', col.price, y);
    doc.text(fmt(invoice.total - invoice.amount_paid), col.amount, y);
    doc.font('Helvetica');
    y += 18;
  }

  if (invoice.notes) {
    y += 20;
    doc.fontSize(10).text('Notes:', 50, y, { underline: true });
    doc.text(invoice.notes, 50, y + 15, { width: 495 });
  }

  doc.end();
}

module.exports = { generateInvoicePdf };
