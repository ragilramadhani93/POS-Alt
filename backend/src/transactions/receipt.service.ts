import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ReceiptOptions {
  paperWidth?: '58mm' | '80mm'; // 58mm = 32 kolom, 80mm = 48 kolom
  showTaxDetails?: boolean;
}

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  private padLine(left: string, right: string, width: number): string {
    const space = width - left.length - right.length;
    if (space <= 0) return `${left} ${right}`.slice(0, width);
    return left + ' '.repeat(space) + right;
  }

  private centerText(text: string, width: number): string {
    if (text.length >= width) return text.slice(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  private divider(char: string = '-', width: number = 32): string {
    return char.repeat(width);
  }

  private formatRupiah(num: number): string {
    return `Rp ${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  async generateReceipt(transactionId: string, options: ReceiptOptions = {}) {
    const width = options.paperWidth === '80mm' ? 48 : 32;

    const trx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        outlet: { include: { company: true } },
        items: { include: { product: true } },
        payments: true,
        appliedPromos: { include: { promotion: true } },
        member: true,
        cashier: true,
      },
    });

    if (!trx) {
      throw new NotFoundException('Transaksi tidak ditemukan untuk cetak struk');
    }

    const lines: string[] = [];
    const outlet = trx.outlet;
    const company = outlet.company;

    // Header Struk
    lines.push(this.centerText(company.name.toUpperCase(), width));
    lines.push(this.centerText(outlet.name, width));
    if (outlet.address) {
      lines.push(this.centerText(outlet.address, width));
    }
    if (outlet.phone) {
      lines.push(this.centerText(`Telp: ${outlet.phone}`, width));
    }
    lines.push(this.divider('=', width));

    // Meta Transaksi
    const dateFormatted = new Date(trx.createdAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    lines.push(this.padLine(`No: ${trx.transactionNumber}`, '', width));
    lines.push(this.padLine(`Waktu: ${dateFormatted}`, '', width));
    lines.push(this.padLine(`Kasir: ${trx.cashier.name}`, `Tipe: ${trx.orderType}`, width));
    if (trx.tableNumber) {
      lines.push(this.padLine(`Meja : ${trx.tableNumber}`, '', width));
    }
    if (trx.member) {
      lines.push(this.padLine(`Member: ${trx.member.name} (${trx.member.currentTier})`, '', width));
    }
    lines.push(this.divider('-', width));

    // Daftar Item Belanja
    for (const item of trx.items) {
      lines.push(item.name.slice(0, width));
      const qtyPrice = `${Number(item.qty)} x ${this.formatRupiah(Number(item.unitPrice))}`;
      const sub = this.formatRupiah(Number(item.subtotal));
      lines.push(this.padLine(`  ${qtyPrice}`, sub, width));

      if (item.modifiers && Array.isArray(item.modifiers)) {
        for (const m of item.modifiers as any[]) {
          lines.push(this.padLine(`   + ${m.name}`, m.priceAdd ? this.formatRupiah(m.priceAdd) : '', width));
        }
      }
      if (item.notes) {
        lines.push(`   * ${item.notes}`.slice(0, width));
      }
    }
    lines.push(this.divider('-', width));

    // Rincian Subtotal, Diskon, Pajak
    lines.push(this.padLine('Subtotal', this.formatRupiah(Number(trx.subtotal)), width));

    if (Number(trx.discountAmount) > 0) {
      lines.push(this.padLine('Total Diskon', `-${this.formatRupiah(Number(trx.discountAmount))}`, width));
      for (const p of trx.appliedPromos) {
        const promoLabel = p.promotion?.name || 'Promo';
        lines.push(this.padLine(`  (${promoLabel.slice(0, 16)})`, `-${this.formatRupiah(Number(p.discountAmount))}`, width));
      }
    }

    if (Number(trx.serviceChargeAmount) > 0) {
      lines.push(this.padLine('Service Charge', this.formatRupiah(Number(trx.serviceChargeAmount)), width));
    }

    if (Number(trx.taxAmount) > 0) {
      const taxLabel = outlet.isTaxInclusive ? 'PPN (Termasuk)' : 'PPN 11%';
      lines.push(this.padLine(taxLabel, this.formatRupiah(Number(trx.taxAmount)), width));
    } else {
      lines.push(this.padLine('Pajak (Bebas Pajak)', 'Rp 0', width));
    }

    if (Number(trx.roundingAmount) !== 0) {
      lines.push(this.padLine('Pembulatan', this.formatRupiah(Number(trx.roundingAmount)), width));
    }

    lines.push(this.divider('=', width));
    lines.push(this.padLine('TOTAL TAGIHAN', this.formatRupiah(Number(trx.totalAmount)), width));
    lines.push(this.divider('-', width));

    // Rincian Pembayaran (Termasuk Split Payment)
    let totalPaid = 0;
    for (const p of trx.payments) {
      const amt = Number(p.amount);
      totalPaid += amt;
      const ref = p.referenceNumber ? ` (${p.referenceNumber.slice(-8)})` : '';
      lines.push(this.padLine(`Bayar ${p.paymentMethod}${ref}`, this.formatRupiah(amt), width));
    }

    const change = Math.max(0, totalPaid - Number(trx.totalAmount));
    if (change > 0) {
      lines.push(this.padLine('KEMBALIAN', this.formatRupiah(change), width));
    }

    // Informasi Loyalty Member (Jika Terdaftar)
    if (trx.member) {
      lines.push(this.divider('-', width));
      lines.push(this.centerText('* LOYALTY MEMBER *', width));
      lines.push(this.padLine('Tier Member', trx.member.currentTier, width));
      lines.push(this.padLine('Saldo Poin Aktif', `${Number(trx.member.totalPoints)} Poin`, width));
      lines.push(this.padLine('Stamps', `${trx.member.totalStamps} / 10 Stamp`, width));
    }

    // Footer
    lines.push(this.divider('-', width));
    lines.push(this.centerText('Terima Kasih Atas Kunjungan Anda', width));
    lines.push(this.centerText('Simpan struk ini sebagai bukti bayar', width));
    lines.push(this.centerText('Wi-Fi: POS-FREE | Pass: kopienak', width));
    lines.push('\n\n\n'); // Paper feed cut

    const rawText = lines.join('\n');

    return {
      transactionId: trx.id,
      transactionNumber: trx.transactionNumber,
      paperWidth: options.paperWidth || '58mm',
      columns: width,
      rawText,
      lines,
    };
  }
}
