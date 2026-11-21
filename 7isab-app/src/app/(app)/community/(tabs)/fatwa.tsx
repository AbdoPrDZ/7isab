import { useTranslation } from 'react-i18next';

import { CommunityScreen } from '@/components/community/community-screen';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';

/** Questions to trusted shaykhs (phase 5). Built in a later phase of the community plan. */
export default function CommunityFatwaScreen() {
  const { t } = useTranslation();

  return (
    <CommunityScreen title={t('community.tabs.fatwa')}>
      <Card>
        <AppText color="textSecondary" align="center">
          {t('community.later.fatwa')}
        </AppText>
      </Card>
    </CommunityScreen>
  );
}
