import { useTranslation } from 'react-i18next';

import { CommunityScreen } from '@/components/community/community-screen';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';

/** End-to-end encrypted chats (phase 6). Built in a later phase of the community plan. */
export default function CommunityChatsScreen() {
  const { t } = useTranslation();

  return (
    <CommunityScreen title={t('community.tabs.chats')}>
      <Card>
        <AppText color="textSecondary" align="center">
          {t('community.later.chats')}
        </AppText>
      </Card>
    </CommunityScreen>
  );
}
