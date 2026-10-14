import { MEDIAPIPE_BASE, MEDIAPIPE_VERSION } from '../mediapipe';

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const path = jest.requireActual<{ dirname(path: string): string; join(...parts: string[]): string }>('path');
const resolve = (require as unknown as { resolve(id: string): string }).resolve;

describe('MediaPipe path', () => {
  it('matches the installed @mediapipe/tasks-vision version', () => {
    const dir = path.dirname(resolve('@mediapipe/tasks-vision'));
    const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version: string };
    expect(MEDIAPIPE_VERSION).toBe(version);
    expect(MEDIAPIPE_BASE).toBe(`/mediapipe/${version}`);
  });
});
