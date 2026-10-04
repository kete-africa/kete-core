import { describe, expect, it } from 'vitest';
import {
  dayOf,
  EXCEL,
  numberOf,
  readSheets,
  readTable,
  SheetError,
  tabular,
} from '../src/index.js';
import { workbook } from './office-fixtures.js';

// Spec 053: a team's spreadsheet read cell by cell, then typed — the rows a product stores and
// charts.

const csv = (text: string) => new TextEncoder().encode(text);

describe('spreadsheets', () => {
  it('reads every sheet of a workbook as a grid', async () => {
    const sheets = await readSheets(
      EXCEL,
      workbook({
        Ventes: [
          ['Mois', 'Montant'],
          ['Janvier', '1200'],
        ],
        Stocks: [['Article'], ['Batterie']],
      }),
    );
    expect(sheets).toEqual([
      {
        name: 'Ventes',
        rows: [
          ['Mois', 'Montant'],
          ['Janvier', '1200'],
        ],
      },
      { name: 'Stocks', rows: [['Article'], ['Batterie']] },
    ]);
    expect(tabular('text/csv')).toBe(true);
    expect(tabular('application/pdf')).toBe(false);
  });

  it('types a table: numbers in French notation, days, texts, empty cells', async () => {
    const table = await readTable(
      'text/csv',
      csv(
        'Agence;Date;Montant;Montant\nLomé;15/11/2026;1 200,50;3\nKara;2026-12-01;950;\nLomé;01/12/2026;;7\n',
      ),
    );
    expect(table.columns).toEqual([
      { name: 'Agence', type: 'text' },
      { name: 'Date', type: 'date' },
      { name: 'Montant', type: 'number' },
      { name: 'Montant (2)', type: 'number' },
    ]);
    expect(table.rows).toEqual([
      { Agence: 'Lomé', Date: '2026-11-15', Montant: 1200.5, 'Montant (2)': 3 },
      { Agence: 'Kara', Date: '2026-12-01', Montant: 950, 'Montant (2)': null },
      { Agence: 'Lomé', Date: '2026-12-01', Montant: null, 'Montant (2)': 7 },
    ]);
    await expect(readTable('application/pdf', csv('x'))).rejects.toThrow(SheetError);
  });

  it('reads the notations people write', () => {
    expect(numberOf('1,200')).toBe(1200);
    expect(numberOf('1,5')).toBe(1.5);
    expect(numberOf('1.200,50')).toBe(1200.5);
    expect(numberOf('1,200.50')).toBe(1200.5);
    expect(numberOf('1.200.000')).toBe(1200000);
    expect(numberOf('25 000 FCFA')).toBe(25000);
    expect(numberOf('12 %')).toBe(12);
    expect(numberOf('abc')).toBeNull();
    expect(dayOf('31/02/2026')).toBeNull();
    expect(dayOf('5/3/2026')).toBe('2026-03-05');
  });
});
