import { de } from '../texte/de';
import { herstellerGruppen } from '../vergleich';
import { ladeVergleich } from '../vergleichDaten';
import { EXCEL_MIME } from './excel';
import { gruppeKopf, gruppeSpalten, gruppeZeilen } from './excelGruppeDaten';

export { EXCEL_MIME };

/** Excel-Datenliste eines Gruppen-Vergleichs: eine Zeile je Bier, je Verkoster Bewertung und Notiz. */
export async function vergleichAlsExcel(vergleichId: string): Promise<Blob> {
  const daten = await ladeVergleich(vergleichId);
  if (!daten) throw new Error('Vergleich nicht gefunden');
  const t = de.gruppeExport.excel;
  const verkoster = daten.quellen.map((q) => q.verkoster);
  const gruppen = herstellerGruppen(daten.biere);
  const zeilen = gruppeZeilen(gruppen, daten.quellen.map((q) => q.tastingId));
  const n = verkoster.length;

  const { default: ExcelJS } = await import('exceljs');
  const mappe = new ExcelJS.Workbook();
  mappe.creator = 'Taste Report';
  const blatt = mappe.addWorksheet(de.excel.blatt, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

  for (const [label, wert] of gruppeKopf(daten.vergleich.name, verkoster, daten.tastings[0], t)) {
    const zeile = blatt.addRow([label, wert]);
    zeile.getCell(1).font = { bold: true };
    zeile.getCell(2).alignment = { horizontal: 'left' };
  }
  blatt.addRow([]);

  const kopfNr = blatt.rowCount + 1;
  const spalten = gruppeSpalten(verkoster, t);
  const kopf = blatt.addRow(spalten);
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
    { width: 11 },
    ...verkoster.map(() => ({ width: 11 })),
    ...verkoster.map(() => ({ width: 40 })),
  ];

  for (const z of zeilen) {
    const zeile = blatt.addRow([z.hersteller, z.standort, z.name, z.stil, z.durchschnitt ?? null, z.anzahl, ...z.werte.map((w) => w ?? null), ...z.notizen]);
    zeile.alignment = { vertical: 'top' };
    zeile.getCell(5).numFmt = '0.00';
    for (let i = 0; i < n; i++) {
      zeile.getCell(7 + i).numFmt = '0.00';
      zeile.getCell(7 + n + i).alignment = { vertical: 'top', wrapText: true };
    }
  }

  blatt.autoFilter = { from: { row: kopfNr, column: 1 }, to: { row: kopfNr, column: spalten.length } };
  blatt.views = [{ state: 'frozen', ySplit: kopfNr }];

  const puffer = await mappe.xlsx.writeBuffer();
  return new Blob([puffer], { type: EXCEL_MIME });
}
