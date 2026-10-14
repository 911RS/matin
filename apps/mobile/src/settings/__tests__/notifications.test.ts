import { notificationsSupported, remotePushSupported } from '../notifications';

describe('notificationsSupported', () => {
  it('is off only in Expo Go on Android', () => {
    expect(notificationsSupported('android', 'storeClient')).toBe(false);
    expect(notificationsSupported('ios', 'storeClient')).toBe(true);
    expect(notificationsSupported('android', 'bare')).toBe(true);
    expect(notificationsSupported('android', 'standalone')).toBe(true);
    expect(notificationsSupported('android', undefined)).toBe(true);
  });

  it('is off on web', () => {
    expect(notificationsSupported('web', undefined)).toBe(false);
    expect(remotePushSupported('web', undefined)).toBe(false);
  });
});

describe('remotePushSupported', () => {
  it('is off in Expo Go on both platforms', () => {
    expect(remotePushSupported('android', 'storeClient')).toBe(false);
    expect(remotePushSupported('ios', 'storeClient')).toBe(false);
    expect(remotePushSupported('android', 'bare')).toBe(true);
    expect(remotePushSupported('ios', 'standalone')).toBe(true);
  });
});

describe('daily reminder', () => {
  it('uses the accent color for the local reminder and the plugin icon', async () => {
    const schedule = jest.fn().mockResolvedValue('id');
    jest.resetModules();
    jest.doMock('expo-notifications', () => ({
      scheduleNotificationAsync: schedule,
      SchedulableTriggerInputTypes: { DAILY: 'daily' },
    }));
    const { scheduleDaily } = require('../notifications') as typeof import('../notifications');
    const { colors } = require('../../theme') as typeof import('../../theme');
    await scheduleDaily(7, 30);
    expect(schedule.mock.calls[0][0].content.color).toBe(colors.accent);

    const app = require('../../../app.json') as { expo: { plugins: unknown[] } };
    const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications') as [string, { icon: string; color: string }];
    expect(plugin[1]).toEqual({ icon: './assets/images/notification-icon.png', color: colors.accent });
  });
});
