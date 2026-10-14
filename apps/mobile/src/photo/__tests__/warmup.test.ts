import { Platform } from 'react-native';
import { prepareModels } from '../../../modules/tenue-photo';
import { warmUpForAdding, warmUpPhotoModels } from '../warmup';

jest.mock('../../../modules/tenue-photo', () => ({ prepareModels: jest.fn() }));

const mocked = prepareModels as jest.Mock;
const os = Platform.OS;

function setOs(value: string) {
  Object.defineProperty(Platform, 'OS', { value, configurable: true });
}

afterEach(() => {
  setOs(os);
  mocked.mockReset();
});

describe('warmUpPhotoModels', () => {
  it('starts model preparation', () => {
    mocked.mockResolvedValue('ready');
    warmUpPhotoModels();
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('attaches a catch handler', () => {
    const catchSpy = jest.fn();
    mocked.mockReturnValue({ catch: catchSpy });
    warmUpPhotoModels();
    expect(catchSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it('swallows a rejection', async () => {
    mocked.mockRejectedValue(new Error('boom'));
    expect(() => warmUpPhotoModels()).not.toThrow();
    await new Promise<void>((r) => setImmediate(() => r()));
  });

  it('swallows a synchronous throw', () => {
    mocked.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(() => warmUpPhotoModels()).not.toThrow();
  });

  it('does nothing at startup on web', () => {
    setOs('web');
    warmUpPhotoModels();
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe('warmUpForAdding', () => {
  it('starts model preparation on web', () => {
    setOs('web');
    mocked.mockResolvedValue('downloading');
    warmUpForAdding();
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('leaves native preparation to startup', () => {
    warmUpForAdding();
    expect(mocked).not.toHaveBeenCalled();
  });
});
