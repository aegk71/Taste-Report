import { db } from '../db';
import { de } from '../texte/de';
import { excelKopf, excelZeilen } from './excelDaten';

export const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** ISO-Datum als Excel-Datum ohne Zeitzonenverschiebung (Mitternacht UTC). */
function excelDatum(iso: string): Date | null {
  const [j, m, t] = iso.split('-').map(Number);
  return j && m && t ? new Date(Date.UTC(j, m - 1, t)) : null;
}

export async function tastingAlsExcel(tastingId: string): Promise<Blob> {
  const tasting = await db.tastings.get(tastingId);
  if (!tasting) throw new Error('Tasting nicht gefunden');
  const hersteller = await db.hersteller.where('tastingId').equals(tastingId).toArray();
  const getraenke = await db.getraenke.where('tastingId').equals(tastingId).toArray();

  const { default: ExcelJS } = await import('exceljs');
  const mappe = new ExcelJS.Workbook();
  mappe.creator = 'Taste Report';
  const blatt = mappe.addWorksheet(de.excel.blatt, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

  for (const [label, wert] of excelKopf(tasting, de.excel)) {
    const zeile = blatt.addRow([label, wert]);
    zeile.getCell(1).font = { bold: true };
    zeile.getCell(2).alignment = { horizontal: 'left' };
  }
  blatt.addRow([]);

  const kopfNr = blatt.rowCount + 1;
  const kopf = blatt.addRow(de.excel.spalten);
  kopf.font = { bold: true };
  kopf.alignment = { vertical: 'middle', wrapText: true };
  kopf.eachCell((zelle) => {
    zelle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4AE45' } };
    zelle.border = { bottom: { style: 'thin', color: { argb: 'FF2B1D14' } } };
  });

  blatt.columns = [
    { width: 24 },
    { width: 12 },
    { width: 28 },
    { width: 16 },
    { width: 11 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 50 },
    { width: 12 },
    { width: 13 },
  ];

  for (const z of excelZeilen(hersteller, getraenke, de.excel)) {
    const datum = z.probiertAm ? excelDatum(z.probiertAm) : null;
    const zeile = blatt.addRow([z.hersteller, z.standort, z.name, z.stil, z.bewertung ?? null, z.abv ?? null, z.menge ?? null, z.preis ?? null, z.notiz, z.zustand, datum]);
    zeile.alignment = { vertical: 'top' };
    zeile.getCell(9).alignment = { vertical: 'top', wrapText: true };
    zeile.getCell(5).numFmt = '0.00';
    zeile.getCell(6).numFmt = '0.0#';
    zeile.getCell(7).numFmt = '0.0##';
    zeile.getCell(8).numFmt = '0.00';
    zeile.getCell(11).numFmt = 'dd.mm.yyyy';
  }

  blatt.autoFilter = { from: { row: kopfNr, column: 1 }, to: { row: kopfNr, column: de.excel.spalten.length } };
  blatt.views = [{ state: 'frozen', ySplit: kopfNr }];

  const puffer = await mappe.xlsx.writeBuffer();
  return new Blob([puffer], { type: EXCEL_MIME });
}
