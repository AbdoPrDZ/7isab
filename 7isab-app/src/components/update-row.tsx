import { useOTA } from 'expo-ota-client';
import { useTranslation } from 'react-i18next';

import { Row } from '@/components/ui/layout';
import { useFormat } from '@/lib/format';

/**
 * Settings → About: checks OTACenter for an update on tap, and installs it when
 * one is waiting (also after "not now" on the update screen).
 */
export function UpdateRow() {
  const { t } = useTranslation();
  const format = useFormat();
  const ota = useOTA();

  let subtitle: string;
  let onPress: (() => void) | undefined = () => void ota.checkForUpdates();
  switch (ota.status) {
    case 'disabled':
      subtitle = t('update.disabled');
      onPress = undefined;
      break;
    case 'checking':
      subtitle = t('update.checking');
      onPress = undefined;
      break;
    case 'up-to-date':
      subtitle = t('update.upToDate');
      break;
    case 'update-available':
      subtitle = t('update.available', { name: ota.update?.bundleName ?? '' }).trim();
      onPress = () => void ota.downloadAndInstall();
      break;
    case 'native-update-available':
      subtitle = t('update.nativeAvailable', { name: ota.nativeUpdate?.name ?? '' }).trim();
      onPress = () => void ota.openNativeUpdate();
      break;
    case 'downloading':
      subtitle =
        ota.progress === null
          ? t('update.downloading')
          : t('update.downloadingProgress', { percent: format.digits(String(Math.round(ota.progress * 100))) });
      onPress = undefined;
      break;
    case 'restarting':
      subtitle = t('update.restarting');
      onPress = undefined;
      break;
    case 'failed':
      subtitle = t('update.failed', { error: ota.error?.message ?? '' });
      onPress = () => void ota.retry();
      break;
    default:
      subtitle = t('update.tapToCheck');
  }

  return <Row title={t('update.check')} subtitle={subtitle} onPress={onPress} />;
}
