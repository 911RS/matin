import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { hasCallbackError } from '../../src/auth/callbackError';
import { waitForSession } from '../../src/auth/waitForSession';
import type { SessionClient } from '../../src/auth/waitForSession';
import { getSupabase } from '../../src/lib/supabase';
import { colors, space } from '../../src/theme';
import { Button } from '../../src/ui';
import { useType } from '../../src/ui/typeContext';

function currentLocation(): { search: string; hash: string } {
  const location = typeof window === 'undefined' ? undefined : window.location;
  return { search: location?.search ?? '', hash: location?.hash ?? '' };
}

function WebCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const type = useType();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const fail = () => router.replace({ pathname: '/sign-in', params: { error: 'callback' } });
    const { search, hash } = currentLocation();
    if (hasCallbackError(search, hash)) {
      fail();
      return;
    }
    let client: SessionClient;
    try {
      client = getSupabase();
    } catch {
      fail();
      return;
    }
    void waitForSession(client)
      .catch(() => null)
      .then((session) => {
        if (!active) return;
        if (session) router.replace('/');
        else setTimedOut(true);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (timedOut) {
    return (
      <View style={styles.root}>
        <Text style={[type.body, styles.message]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t('auth.callbackTimeout')}
        </Text>
        <Button label={t('auth.backToSignIn')} onPress={() => router.replace('/sign-in')} />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.ink} accessibilityLabel={t('auth.signingIn')} />
    </View>
  );
}

export default function AuthCallback() {
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  return <WebCallback />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(16),
    padding: space(24),
    backgroundColor: colors.paper,
  },
  message: { textAlign: 'center' },
});
