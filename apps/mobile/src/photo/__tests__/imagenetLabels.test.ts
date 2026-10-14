import { labelsToCategory } from '@tenue/engine';
import { imagenetToLabels } from '../imagenetLabels';

function c(categoryName: string, score: number) {
  return { categoryName, score };
}

describe('imagenetToLabels', () => {
  it('maps clothing classes to labels the tagger understands', () => {
    expect(imagenetToLabels([c('jean', 0.6)])).toEqual(['Jeans']);
    expect(labelsToCategory(imagenetToLabels([c('jean', 0.6)]))).toBe('bottom');
    expect(labelsToCategory(imagenetToLabels([c('jersey', 0.4)]))).toBe('top');
    expect(labelsToCategory(imagenetToLabels([c('sweatshirt', 0.4)]))).toBe('top');
    expect(labelsToCategory(imagenetToLabels([c('cardigan', 0.4)]))).toBe('outerwear');
    expect(labelsToCategory(imagenetToLabels([c('trench coat', 0.4)]))).toBe('outerwear');
    expect(labelsToCategory(imagenetToLabels([c('miniskirt', 0.4)]))).toBe('bottom');
    expect(labelsToCategory(imagenetToLabels([c('gown', 0.4)]))).toBe('dress');
    expect(labelsToCategory(imagenetToLabels([c('running shoe', 0.4)]))).toBe('shoes');
    expect(labelsToCategory(imagenetToLabels([c('Loafer', 0.4)]))).toBe('shoes');
    expect(labelsToCategory(imagenetToLabels([c('cowboy boot', 0.4)]))).toBe('shoes');
    expect(labelsToCategory(imagenetToLabels([c('shoe shop', 0.4)]))).toBe('shoes');
  });

  it('drops classes with no clothing meaning', () => {
    expect(imagenetToLabels([c('golden retriever', 0.9), c('Cardigan', 0.8), c('wool', 0.5)])).toEqual([]);
  });

  it('orders by score and removes duplicates', () => {
    expect(
      imagenetToLabels([c('miniskirt', 0.1), c('jean', 0.7), c('overskirt', 0.3), c('sweatshirt', 0.2)]),
    ).toEqual(['Jeans', 'Skirt', 'Sweatshirt']);
  });

  it('keeps at most ten labels', () => {
    const many = ['jean', 'jersey', 'sweatshirt', 'cardigan', 'trench coat', 'miniskirt', 'gown', 'running shoe', 'Loafer', 'sandal', 'cowboy boot', 'swimming trunks'];
    expect(imagenetToLabels(many.map((name, i) => c(name, 1 - i / 100)))).toHaveLength(10);
  });

  it('ignores missing names', () => {
    expect(imagenetToLabels([{ score: 0.9 }, c('jean', 0.5)])).toEqual(['Jeans']);
  });
});
