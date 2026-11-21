import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { HomeIcon, MenuIcon } from '@/components/ui/icons';
import { Divider, IconButton, Row, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { useMemberProfile } from '@/lib/community/membership';

/** Leaves the community space and returns to the 7isab home screen. */
export function backTo7isab(): void {
  router.dismissTo('/');
}

/** A community tab screen: menu button, title, and a quick way back to 7isab. */
export function CommunityScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Screen
        inTabs
        title={title}
        subtitle={subtitle}
        headerStart={
          <IconButton label={t('community.menu.open')} tone="onHero" onPress={() => setMenuOpen(true)}>
            <MenuIcon size={22} color={theme.onHero} />
          </IconButton>
        }
        headerEnd={
          <IconButton label={t('community.menu.back')} tone="onHero" onPress={backTo7isab}>
            <HomeIcon size={22} color={theme.onHero} />
          </IconButton>
        }>
        {children}
      </Screen>
      <CommunityMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/** The community drawer, as a side sheet on the start side. */
function CommunityMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { direction } = useDirection();
  const profile = useMemberProfile();

  const open = (href: Href) => {
    onClose();
    router.push(href);
  };


  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { direction }]}>
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.background, borderColor: theme.border, paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.profile}>
              <AppText variant="heading">
                {profile.first_name} {profile.last_name}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('community.title')}
              </AppText>
            </View>
            <Divider />
            <Row title={t('community.menu.settings')} chevron onPress={() => open('/community/settings')} />
            <Row title={t('community.menu.mySpaces')} chevron onPress={() => open('/community/groups')} />
            <Row title={t('community.menu.myRequests')} chevron onPress={() => open('/community/requests')} />
            <Row title={t('community.menu.saved')} chevron onPress={() => open('/community/saved')} />
            <Row title={t('community.menu.events')} chevron onPress={() => open('/community/events')} />
            <Row title={t('community.menu.rules')} chevron onPress={() => open('/community/rules')} />
            <Divider />
            <Row
              title={t('community.menu.back')}
              onPress={() => {
                onClose();
                backTo7isab();
              }}
            />
          </ScrollView>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  panel: { width: '80%', maxWidth: 340, borderEndWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four },
  content: { gap: Spacing.two },
  profile: { gap: Spacing.half, paddingVertical: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
