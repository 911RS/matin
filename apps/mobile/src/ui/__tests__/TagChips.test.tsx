import { fireEvent, render, screen } from '@testing-library/react-native';
import { ColorChoices, TagChips } from '../TagChips';

const options = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'shoes', label: 'Shoes' },
] as const;

describe('TagChips', () => {
  it('marks only the selected chip as selected', async () => {
    await render(<TagChips label="Category" options={options} value="bottom" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Bottom' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByRole('button', { name: 'Top' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('calls onChange with the tapped value', async () => {
    const onChange = jest.fn();
    await render(<TagChips label="Category" options={options} value={null} onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Shoes' }));
    expect(onChange).toHaveBeenCalledWith('shoes');
  });

  it('shows its group label', async () => {
    await render(<TagChips label="Category" options={options} value={null} onChange={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Category' })).toBeTruthy();
  });

  it('works with numeric values', async () => {
    const onChange = jest.fn();
    const warmth = [
      { value: 1, label: 'Light' },
      { value: 2, label: 'Medium' },
    ];
    await render(<TagChips label="Warmth" options={warmth} value={2} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Medium' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('ColorChoices', () => {
  it('selects the current family and reports taps', async () => {
    const onChange = jest.fn();
    await render(
      <ColorChoices
        label="Color"
        families={['navy', 'red']}
        labelFor={(f) => f.toUpperCase()}
        value="navy"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'NAVY' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'RED' }));
    expect(onChange).toHaveBeenCalledWith('red');
  });
});
