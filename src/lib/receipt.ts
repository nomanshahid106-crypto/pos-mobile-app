import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatMoney, toCents } from './money';

export interface ReceiptData {
  storeName: string; storeAddress?: string | null; storePhone?: string | null;
  receiptNumber: string; createdAt: string; cashierEmail?: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number; discount: number; tax: number; total: number;
  paymentMethod: string; amountReceived?: number | null; changeDue?: number | null;
  currency: string; footer: string;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
export function receiptText(r: ReceiptData): string {
  const lines = [r.storeName, r.storeAddress ?? '', r.storePhone ?? '', `Receipt: ${r.receiptNumber}`, `Date: ${new Date(r.createdAt).toLocaleString()}`, r.cashierEmail ? `Cashier: ${r.cashierEmail}` : '', '--------------------------------',
    ...r.items.map((i) => `${i.name} x${i.quantity}  ${formatMoney(toCents(i.unitPrice) * i.quantity, r.currency)}`),
    '--------------------------------', `Subtotal: ${formatMoney(toCents(r.subtotal), r.currency)}`, `Discount: -${formatMoney(toCents(r.discount), r.currency)}`, `Tax: ${formatMoney(toCents(r.tax), r.currency)}`, `TOTAL: ${formatMoney(toCents(r.total), r.currency)}`, `Paid via: ${r.paymentMethod}`,
    r.amountReceived != null ? `Received: ${formatMoney(toCents(r.amountReceived), r.currency)}` : '', r.changeDue != null ? `Change: ${formatMoney(toCents(r.changeDue), r.currency)}` : '', '', r.footer];
  return lines.filter(Boolean).join('\n');
}
export function receiptHtml(r: ReceiptData): string {
  const rows = r.items.map((i) => `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatMoney(toCents(i.unitPrice), r.currency)}</td><td style="text-align:right">${formatMoney(toCents(i.unitPrice) * i.quantity, r.currency)}</td></tr>`).join('');
  return `<html><body style="font-family:monospace;max-width:340px;margin:auto"><h2 style="text-align:center">${esc(r.storeName)}</h2><p style="text-align:center">${esc(r.storeAddress ?? '')}<br/>${esc(r.storePhone ?? '')}</p><p>Receipt: ${esc(r.receiptNumber)}<br/>${new Date(r.createdAt).toLocaleString()}<br/>${r.cashierEmail ? `Cashier: ${esc(r.cashierEmail)}` : ''}</p><table style="width:100%"><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th><th align="right">Total</th></tr>${rows}</table><hr/><p>Subtotal: ${formatMoney(toCents(r.subtotal), r.currency)}<br/>Discount: -${formatMoney(toCents(r.discount), r.currency)}<br/>Tax: ${formatMoney(toCents(r.tax), r.currency)}<br/><b>TOTAL: ${formatMoney(toCents(r.total), r.currency)}</b><br/>Paid via: ${esc(r.paymentMethod)}${r.amountReceived != null ? `<br/>Received: ${formatMoney(toCents(r.amountReceived), r.currency)}` : ''}${r.changeDue != null ? `<br/>Change: ${formatMoney(toCents(r.changeDue), r.currency)}` : ''}</p><p style="text-align:center">${esc(r.footer)}</p></body></html>`;
}
export async function printReceipt(r: ReceiptData) { await Print.printAsync({ html: receiptHtml(r) }); }
export async function shareReceipt(r: ReceiptData) {
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(r) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
