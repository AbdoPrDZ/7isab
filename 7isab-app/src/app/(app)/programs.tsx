import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes, type Program, type Relapse } from '@/lib/ledger/types';
import {
  isActive,
  programReport,
  programWholeRange,
  streaks,
  useCategoryLabel,
  usePrograms,
} from '@/lib/programs/programs';

/** Improving / healing / custom programs: active first, then finished ones. */
export default function ProgramsScreen() {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const programs = usePrograms();
  const categoryLabel = useCategoryLabel();
  // Re-render on progress / relapses (scores and streaks).
  useDocs(RecordTypes.progress);
  const relapses = useDocs<Relapse>(RecordTypes.relapse);

  const active = programs.filter((program) => !program.archived);
  const finished = programs.filter((program) => program.archived);

  const subtitle = (program: Program) => {
    const parts = [categoryLabel(program)];
    if (program.category === 'healing') {
      const { current } = streaks(program, relapses.filter((item) => item.programId === program.id));
      parts.push(t('programs.cleanDays', { count: current, days: format.number(current) }));
    }
    if (program.endDate) parts.push(t('programs.until', { day: format.day(program.endDate) }));
    else if (!isActive(program)) parts.push(t('programs.notStarted'));
    return parts.join(' · ');
  };

  const score = (program: Program) => {
    const { start, end } = programWholeRange(program);
    const report = programReport(program, start, end);
    return report.score === null ? '—' : format.digits(`${Math.round(report.score * 100)}%`);
  };

  const list = (items: Program[]) => (
    <Card>
      {items.map((program, index) => (
        <Fragment key={program.id}>
          {index > 0 ? <Divider /> : null}
          <Row
            title={program.name}
            subtitle={subtitle(program)}
            value={score(program)}
            chevron
            onPress={() => router.push(`/program/${program.id}`)}
          />
        </Fragment>
      ))}
    </Card>
  );

  return (
    <Screen back title={t('programs.title')} subtitle={t('programs.subtitle')}>
      <Button title={t('programs.new')} onPress={() => router.push('/program/new')} />
      {active.length ? (
        <Section title={t('programs.active')}>{list(active)}</Section>
      ) : (
        <Card>
          <AppText variant="label" color="textSecondary" align="center">
            {t('programs.empty')}
          </AppText>
        </Card>
      )}
      {finished.length ? <Section title={t('programs.finished')}>{list(finished)}</Section> : null}
    </Screen>
  );
}
