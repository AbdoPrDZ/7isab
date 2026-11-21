import { useTranslation } from 'react-i18next';

import { CommunityScreen } from '@/components/community/community-screen';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';

/** Groups the member belongs to and discovery (phase 2). Built in a later phase of the community plan. */
export default function CommunityGroupsScreen() {
  const { t } = useTranslation();

  return (
    <CommunityScreen title={t('community.tabs.groups')}>
      <Card>
        <AppText color="textSecondary" align="center">
          {t('community.later.groups')}
        </AppText>
      </Card>
    </CommunityScreen>
  );
}
