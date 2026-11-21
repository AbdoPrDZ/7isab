import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, Screen } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMySpaceRequests } from '@/lib/community/api';
import type { SpaceRequestItem } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** The member's group and page requests and what the admins decided. */
export default function SpaceRequestsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [requests, setRequests] = useState<SpaceRequestItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMySpaceRequests(token)
        .then((result) => !cancelled && setRequests(result.requests))
        .catch(() => !cancelled && setRequests([]));
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  return (
    <Screen back title={t('community.menu.myRequests')}>
      {!requests ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {requests && requests.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.request.none')}
        </AppText>
      ) : null}
      {requests?.map((item) => (
        <Card key={item.id} style={styles.item} tone={item.status === 'rejected' ? 'danger' : 'surface'}>
          <AppText weight="semibold">{item.name}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t(`community.spaces.types.${item.type}`)} · {t(`community.request.statuses.${item.status}`)}
          </AppText>
          {item.admin_note ? <AppText>{item.admin_note}</AppText> : null}
          {item.status === 'changes_requested' ? (
            <Button
              title={t('community.request.edit')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/community/request', params: { id: String(item.id) } })}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  item: { gap: Spacing.one },
});
