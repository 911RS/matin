import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { getSupabase } from '../src/lib/supabase';
import { startGuest } from '../src/auth/guest';
import { GoogleMark } from '../src/auth/GoogleMark';
import { SignInArt } from '../src/auth/SignInArt';
import { sendEmailCode, signInWithApple, startGoogle, verifyEmailCode } from '../src/auth/signIn';
import { colors, space, tabular } from '../src/theme';
import { Button } from '../src/ui/Button';
import { Field, FIELD_HEIGHT } from '../src/ui/Field';
import { Screen } from '../src/ui/Screen';
import { useType } from '../src/ui/typeContext';

WebBrowser.maybeCompleteAuthSession();

type ErrorKey = 'auth.failed' | 'auth.invalidCode' | 'auth.sendFailed' | 'auth.emailInvalid' | 'auth.callbackFailed';
type Step = 'choose' | 'email' | 'code';
type Action = 'apple' | 'google' | 'guest' | 'send' | 'verify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const BUTTON_HEIGHT = FIELD_HEIGHT;

function requestAppleCredential() {
  return AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
}

function openBrowser(url: string, redirectTo: string) {
  return WebBrowser.openAuthSessionAsync(url, redirectTo);
}

export default function SignIn() {
  const { t } = useTranslation();
  const type = useType();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const params = useLocalSearchParams<{ error?: string }>();
  const [error, setError] = useState<ErrorKey | null>(() => (params.error === 'callback' ? 'auth.callbackFailed' : null));

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (active) setAppleAvailable(ok);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const busy = pending !== null;

  const run = async (action: Action, task: () => Promise<unknown>, failure: ErrorKey) => {
    setPending(action);
    setError(null);
    try {
      await task();
    } catch {
      if (mounted.current) setError(failure);
    } finally {
      if (mounted.current) setPending(null);
    }
  };

  const onApple = () => run('apple', () => signInWithApple(getSupabase(), requestAppleCredential), 'auth.failed');

  const onGoogle = () =>
    run(
      'google',
      () =>
        startGoogle(getSupabase(), openBrowser, makeRedirectUri({ scheme: 'matin', path: 'auth/callback' })),
      'auth.failed',
    );

  const onSendCode = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('auth.emailInvalid');
      return;
    }
    void run('send', async () => {
      await sendEmailCode(getSupabase(), email);
      setCode('');
      setStep('code');
    }, 'auth.sendFailed');
  };

  const onVerify = () => {
    if (!CODE_RE.test(code.trim())) {
      setError('auth.invalidCode');
      return;
    }
    void run('verify', () => verifyEmailCode(getSupabase(), email, code), 'auth.invalidCode');
  };

  const onOtherEmail = () => {
    setError(null);
    setCode('');
    setStep('email');
  };

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  return (
    <Screen scroll contentContainerStyle={styles.layout}>
      <SignInArt compact={step !== 'choose'} />

      <View style={styles.header}>
        <Text style={type.display} accessibilityRole="header">
          {t('auth.title')}
        </Text>
        <Text style={[type.body, styles.tagline]}>{t('auth.tagline')}</Text>
      </View>

      {step === 'choose' && (
        <View style={styles.actions}>
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={BUTTON_HEIGHT / 2}
              style={styles.apple}
              accessibilityLabel={t('auth.apple')}
              onPress={() => {
                if (!busy) void onApple();
              }}
            />
          )}
          <Button
            label={t('auth.google')}
            icon={<GoogleMark />}
            variant="secondary"
            onPress={() => void onGoogle()}
            loading={pending === 'google'}
            blocked={busy && pending !== 'google'}
          />
          <Button
            label={t('auth.email')}
            icon="mail-outline"
            variant="secondary"
            onPress={() => goTo('email')}
            blocked={busy}
          />
          <Button
            label={t('auth.continueGuest')}
            variant="text"
            onPress={() => void run('guest', () => startGuest(), 'auth.failed')}
            loading={pending === 'guest'}
            blocked={busy && pending !== 'guest'}
          />
        </View>
      )}

      {step === 'email' && (
        <View style={styles.actions}>
          <Field
            label={t('auth.emailLabel')}
            nativeID="email-label"
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            autoFocus
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSendCode}
            editable={!busy}
          />
          <Button label={t('auth.sendCode')} onPress={onSendCode} loading={pending === 'send'} />
          <Button label={t('common.back')} variant="text" onPress={() => goTo('choose')} blocked={busy} />
        </View>
      )}

      {step === 'code' && (
        <View style={styles.actions}>
          <Text style={type.body} accessibilityLiveRegion="polite">
            {t('auth.codeSent', { email: email.trim() })}
          </Text>
          <Field
            label={t('auth.codeLabel')}
            nativeID="code-label"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('auth.codePlaceholder')}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={onVerify}
            editable={!busy}
            style={code ? [type.title, styles.code] : undefined}
          />
          <Button label={t('auth.verify')} onPress={onVerify} loading={pending === 'verify'} />
          <Button label={t('auth.useOtherEmail')} variant="text" onPress={onOtherEmail} blocked={busy} />
        </View>
      )}

      {error && (
        <Text style={[type.body, styles.error]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(error)}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { paddingTop: space(8), paddingBottom: space(12) },
  header: { gap: space(8), marginTop: space(24) },
  tagline: { color: colors.graphite },
  actions: { gap: space(12), marginTop: space(24) },
  apple: { height: BUTTON_HEIGHT, width: '100%' },
  code: { ...tabular, letterSpacing: 6 },
  error: { color: colors.danger, marginTop: space(12) },
});
