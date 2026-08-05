import { parseShopNameFromOcrText } from '@/lib/activities/parse-shop-name-from-ocr';

describe('parseShopNameFromOcrText', () => {
  it('picks the first big title from a paper receipt', () => {
    const text = `
CHIPOTLE MEXICAN GRILL
123 Main St
Austin TX 78701
(512) 555-0100

Burrito Bowl          12.50
Chips & Guac           4.25
TOTAL                 16.75
`;
    expect(parseShopNameFromOcrText(text)).toBe('CHIPOTLE MEXICAN GRILL');
  });

  it('skips thank-you / receipt chrome and address lines', () => {
    const text = `
Thank you for visiting
Receipt
BLUE BOTTLE COFFEE
45 Market Street
Suite 200
Latte                  5.50
TOTAL                  5.50
`;
    expect(parseShopNameFromOcrText(text)).toBe('BLUE BOTTLE COFFEE');
  });

  it('returns null when no title-like line exists', () => {
    expect(
      parseShopNameFromOcrText(`
TOTAL 42.00
Tax 3.00
`),
    ).toBeNull();
  });
});
