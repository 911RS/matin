import { fireEvent, render, screen } from '@testing-library/react-native';
import { initI18n } from '../../i18n';
import { CropEditor } from '../CropEditor';
import { FULL_CROP } from '../cropMath';

beforeAll(async () => {
  await initI18n('en');
});

function show(onDone = jest.fn(), onCancel = jest.fn()) {
  return render(<CropEditor visible uri="file:///cut.png" aspect={0.75} onDone={onDone} onCancel={onCancel} />);
}

describe('CropEditor', () => {
  it('returns the whole image when Done is tapped without dragging', async () => {
    const onDone = jest.fn();
    await show(onDone);
    expect(screen.getByRole('header', { name: 'Crop' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith(FULL_CROP);
  });

  it('cancels without a result', async () => {
    const onDone = jest.fn();
    const onCancel = jest.fn();
    await show(onDone, onCancel);
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers the four corners and the frame as drag targets', async () => {
    await show();
    for (const id of ['crop-tl', 'crop-tr', 'crop-bl', 'crop-br', 'crop-move']) expect(screen.getByTestId(id)).toBeTruthy();
  });
});
