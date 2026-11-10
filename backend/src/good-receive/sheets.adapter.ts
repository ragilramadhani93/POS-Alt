import { NotFoundException, BadRequestException } from '@nestjs/common';

// Adapter untuk membaca data pengiriman dari BPSJ 2026 Google Sheets
export interface BpsjSheetRow {
  kodeBarang: string;
  namaBarang: string;
  brand: string;
  satuan: string;
  qtySj: number;
}

export interface BpsjSuratJalanData {
  noSj: string;
  kodeSj: string;
  noBp: string;
  tglSj: string;
  picName: string;
  items: BpsjSheetRow[];
}

export class SheetsAdapter {
  // Simulasi database pengiriman surat jalan BPSJ GUDANG 2026 (Tab BP)
  private static sjDatabase: Record<string, BpsjSuratJalanData> = {
    'SJ/0137/1126/KA': {
      noSj: 'SJ/0137/1126/KA',
      kodeSj: 'SJ/0137/1126/KA',
      noBp: 'BP/0137/1126/KA',
      tglSj: '2026-11-10',
      picName: 'YUDI',
      items: [
        { kodeBarang: '00M.STXXX.X0000094XX', namaBarang: 'PET STRAWLESS FLAT LID KA COFFEE CORNER - MULTIPACK', brand: 'KA', satuan: 'PCS', qtySj: 800 },
        { kodeBarang: '00M.STXXX.X0000144XX', namaBarang: 'CUP PET 12 OZ KACC - STARINDO', brand: 'KA', satuan: 'PCS', qtySj: 500 },
        { kodeBarang: '00M.STXXX.X0000010XX', namaBarang: 'FRESH MILK PLAIN 946ML - DIAMOND', brand: 'KA', satuan: 'PCS', qtySj: 36 },
      ],
    },
    'SJ/0138/1126/KA': {
      noSj: 'SJ/0138/1126/KA',
      kodeSj: 'SJ/0138/1126/KA',
      noBp: 'BP/0138/1126/KA',
      tglSj: '2026-11-10',
      picName: 'AGUS',
      items: [
        { kodeBarang: '00M.STXXX.X0000010XX', namaBarang: 'FRESH MILK PLAIN 946ML - DIAMOND', brand: 'KA', satuan: 'PCS', qtySj: 24 },
        { kodeBarang: 'RAW-KOP-01', namaBarang: 'Biji Kopi Espresso Blend', brand: 'NUSANTARA', satuan: 'GR', qtySj: 10000 },
      ],
    },
  };

  static async fetchBpsjSheet(noSj: string): Promise<BpsjSuratJalanData> {
    if (!noSj || !noSj.trim()) {
      throw new BadRequestException('Nomor Surat Jalan wajib diisi');
    }
    const cleanNo = noSj.trim();
    const found = this.sjDatabase[cleanNo];
    if (found) {
      return found;
    }

    // Jika format mengandung SJ/ atau BP/ izinkan dynamic mock untuk pengujian
    if (cleanNo.toUpperCase().startsWith('SJ') || cleanNo.toUpperCase().startsWith('BP')) {
      return {
        noSj: cleanNo,
        kodeSj: cleanNo,
        noBp: `BP/${cleanNo.replace(/[^0-9]/g, '').slice(-4) || '9999'}/1126/KA`,
        tglSj: new Date().toISOString().slice(0, 10),
        picName: 'LOGISTIK PUSAT',
        items: [
          { kodeBarang: '00M.STXXX.X0000094XX', namaBarang: 'PET STRAWLESS FLAT LID KA COFFEE CORNER - MULTIPACK', brand: 'KA', satuan: 'PCS', qtySj: 300 },
          { kodeBarang: '00M.STXXX.X0000144XX', namaBarang: 'CUP PET 12 OZ KACC - STARINDO', brand: 'KA', satuan: 'PCS', qtySj: 250 },
        ],
      };
    }

    throw new NotFoundException(`Surat Jalan ${noSj} tidak ditemukan pada Google Sheets BPSJ tab BP`);
  }
}
