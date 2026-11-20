import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider, Row, Screen } from '@/components/ui/layout';
import { useLedgerLabels, useTasks } from '@/lib/ledger/hooks';
import type { Task } from '@/lib/ledger/types';

export default function TasksScreen() {
  const { t } = useTranslation();
  const tasks = useTasks();
  const { format } = useLedgerLabels();

  const describe = (task: Task) =>
    [
      t(`task.kinds.${task.kind}`),
      task.fasting && task.fasting !== 'custom'
        ? t(`task.fastingPresets.${task.fasting}`)
        : task.repeat.kind === 'weekdays'
          ? task.repeat.days.map((day) => t(`task.days.${day}`)).join(' ')
          : t(`task.repeats.${task.repeat.kind}`),
      task.target.unit !== 'check' ? `${format.number(task.target.amount)} ${t(`task.units.${task.target.unit}`)}` : null,
      task.archived ? t('task.archived') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen
      back
      title={t('task.allTitle')}
      footer={
        <Button title={t('today.addTask')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })} />
      }>
      <Card>
        {tasks.length ? (
          tasks.map((task, index) => (
            <Fragment key={task.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                title={task.title}
                subtitle={describe(task)}
                value={task.plain ? t('task.plain') : `+${format.points(task.reward)} / −${format.points(task.penalty)}`}
                chevron
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
              />
            </Fragment>
          ))
        ) : (
          <AppText variant="label" color="textSecondary" align="center">
            {t('task.empty')}
          </AppText>
        )}
      </Card>
    </Screen>
  );
}
