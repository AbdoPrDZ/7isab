import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips, Row, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { getHidden, unhidePerson } from '@/lib/community/api';
import { useSession } from '@/lib/session/session-provider';

type Kind = 'blocks' | 'mutes';
type Person = { id: number; first_name: string; last_name: string };

/** People the member blocked (hidden both ways) or muted (hidden from them only). */
export default function HiddenPeopleScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [kind, setKind] = useState<Kind>('mutes');
  const [people, setPeople] = useState<Person[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    getHidden(token, kind)
      .then((result) => !cancelled && setPeople(result.items))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, [token, kind]);

  useFocusEffect(load);

  return (
    <Screen back title={t('community.hidden.title')}>
      <Chips
        options={[
          { value: 'mutes' as Kind, label: t('community.hidden.mutes') },
          { value: 'blocks' as Kind, label: t('community.hidden.blocks') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <AppText variant="caption" color="textSecondary">
        {kind === 'mutes' ? t('community.posts.muteHint') : t('community.posts.blockHint')}
      </AppText>
      {people.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.hidden.none')}
        </AppText>
      ) : null}
      {people.map((person) => (
        <Row
          key={person.id}
          title={`${person.first_name} ${person.last_name}`}
          end={
            <Button
              title={kind === 'mutes' ? t('community.hidden.unmute') : t('community.hidden.unblock')}
              variant="ghost"
              onPress={async () => {
                await unhidePerson(token, kind, person.id).catch(() => undefined);
                load();
              }}
            />
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
});
