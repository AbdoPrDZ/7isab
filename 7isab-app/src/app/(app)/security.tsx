import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { applyDigits } from '@/lib/format';
import {
  LOCK_TIMEOUTS,
  biometricAvailable,
  hasPin,
  setLockMode,
  setLockTimeout,
  setPin,
  useLockStore,
  type LockMode,
} from '@/lib/lock/app-lock';

export default function SecurityScreen() {
  const { t } = useTranslation();
  const mode = useLockStore((state) => state.mode);
  const timeout = useLockStore((state) => state.timeout);
  const [pin, setPinText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [biometric, setBiometric] = useState(false);
  const [pinReady, setPinReady] = useState(hasPin());
  const [wanted, setWanted] = useState<LockMode>(mode);

  useEffect(() => {
    void biometricAvailable().then(setBiometric);
  }, []);

  const chooseMode = (next: LockMode) => {
    setError(null);
    setInfo(null);
    if (next === 'biometric' && !biometric) return setError(t('security.biometricUnavailable'));
    setWanted(next);
    if (next === 'none') setLockMode('none');
    else if (pinReady) setLockMode(next);
    else if (next === 'biometric') setInfo(t('security.biometricNeedsPin'));
  };

  const savePin = () => {
    const clean = applyDigits(pin, 'latn');
    if (!/^\d{4,8}$/.test(clean)) return setError(t('security.pinTooShort'));
    if (clean !== applyDigits(confirm, 'latn')) return setError(t('security.pinMismatch'));
    setPin(clean);
    setPinReady(true);
    setLockMode(wanted === 'none' ? 'pin' : wanted);
    setPinText('');
    setConfirm('');
    setError(null);
    setInfo(t('security.pinSaved'));
  };

  const showPinForm = wanted !== 'none';

  return (
    <Screen back title={t('security.title')}>
      <Section title={t('security.mode')}>
        <Chips
          options={(['none', 'pin', 'biometric'] as const).map((value) => ({ value, label: t(`security.modes.${value}`) }))}
          value={wanted}
          onChange={chooseMode}
        />
      </Section>

      {showPinForm ? (
        <Card>
          <AppText variant="label" weight="semibold">
            {pinReady ? t('security.changePin') : t('security.setPin')}
          </AppText>
          <TextField
            label={t('security.newPin')}
            value={pin}
            onChangeText={setPinText}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
          />
          <TextField
            label={t('security.confirmPin')}
            value={confirm}
            onChangeText={setConfirm}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
          />
          <Button title={t('common.save')} onPress={savePin} />
        </Card>
      ) : null}

      {error ? (
        <AppText variant="label" color="danger">
          {error}
        </AppText>
      ) : null}
      {info ? (
        <AppText variant="label" color="primary">
          {info}
        </AppText>
      ) : null}

      {mode !== 'none' ? (
        <Section title={t('security.timeout')}>
          <Chips
            options={LOCK_TIMEOUTS.map((value) => ({ value, label: t(`security.timeouts.${value}`) }))}
            value={timeout}
            onChange={setLockTimeout}
          />
        </Section>
      ) : null}
    </Screen>
  );
}
