import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PencilIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import { pickProfilePhoto, removeProfilePhoto, useProfilePhoto, type PhotoSource } from '@/lib/profile/profile';
import { useSession } from '@/lib/session/session-provider';

/**
 * The user's photo, or the first letter of their name when there is none.
 * `editable`: tapping it offers gallery / camera / remove. Otherwise `onPress` runs.
 */
export function ProfileAvatar({
  size = 48,
  editable = false,
  onPress,
  tone = 'surface',
}: {
  size?: number;
  editable?: boolean;
  onPress?: () => void;
  /** `onHero` for the emerald header. */
  tone?: 'surface' | 'onHero';
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useSession();
  const photo = useProfilePhoto();
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const pick = async (source: PhotoSource) => {
    try {
      const result = await pickProfilePhoto(source);
      if (result === 'denied') Alert.alert(t('profile.cameraDenied'));
    } catch {
      Alert.alert(t('profile.failed'));
    }
  };

  const edit = () =>
    Alert.alert(t('profile.photo'), undefined, [
      { text: t('profile.fromGallery'), onPress: () => void pick('library') },
      { text: t('profile.takePhoto'), onPress: () => void pick('camera') },
      ...(photo ? [{ text: t('profile.remove'), style: 'destructive' as const, onPress: () => void removeProfilePhoto() }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  const press = editable ? edit : onPress;
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <Pressable
      accessibilityRole={press ? 'button' : 'image'}
      accessibilityLabel={editable ? t('profile.change') : t('profile.photo')}
      disabled={!press}
      onPress={press}
      hitSlop={6}>
      {photo ? (
        <Image source={{ uri: photo }} style={[circle, styles.border, { borderColor: theme.accent }]} />
      ) : (
        <View
          style={[
            circle,
            styles.border,
            styles.center,
            tone === 'onHero'
              ? { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: theme.accent }
              : { backgroundColor: theme.primarySoft, borderColor: theme.accent },
          ]}>
          <AppText variant={size >= 44 ? 'heading' : 'label'} weight="bold" color={tone === 'onHero' ? 'onHero' : 'primary'}>
            {initial}
          </AppText>
        </View>
      )}
      {editable ? (
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
          <PencilIcon size={12} color={theme.onHero} strokeWidth={2.5} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  border: { borderWidth: 1.5 },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    bottom: -2,
    end: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
