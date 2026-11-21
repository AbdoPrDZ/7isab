import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { QURAN_FONT } from '@/components/quran/mushaf-page';
import { SearchGroupCard } from '@/components/search/search-results';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useQuranMeta } from '@/lib/quran/hooks';
import { downloadQuran, useQuranSearch } from '@/lib/quran/search';

/**
 * Quran results for a query: offers the one-time download when the Quran
 * isn't all on the phone yet, shows its progress, then the matching ayat.
 * `compact` (global search): no "no results" card.
 */
export function QuranResults({ query, compact = false }: { query: string; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const meta = useQuranMeta();
  const version = meta.data?.version;
  const total = meta.data?.pages ?? 604;
  const { status, results, total: count } = useQuranSearch(version, total, query);

  if (query.trim().length < 2) return null;
  if (!version) {
    return compact ? null : (
      <Card>
        <AppText variant="label" color="textSecondary" align="center">
          {meta.error ? t('search.quranOffline') : t('search.quranLoading')}
        </AppText>
      </Card>
    );
  }

  if (status.state === 'missing' || status.state === 'error' || status.state === 'downloading') {
    const have = status.state === 'downloading' ? status.done : status.have;
    return (
      <Card>
        <View style={styles.gap}>
          <AppText variant="label" weight="semibold">
            {t('search.quranTitle')}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {status.state === 'downloading'
              ? t('search.quranDownloading', { done: format.number(have), total: format.number(status.total) })
              : status.state === 'error'
                ? t('search.quranFailed', { done: format.number(have), total: format.number(status.total) })
                : t('search.quranNeedsDownload', { done: format.number(have), total: format.number(status.total) })}
          </AppText>
          {status.state === 'downloading' ? (
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[styles.fill, { width: `${Math.round((have / status.total) * 100)}%`, backgroundColor: theme.primary }]}
              />
            </View>
          ) : (
            <Button
              title={status.state === 'error' ? t('search.quranRetry') : t('search.quranDownload')}
              variant="secondary"
              onPress={() => void downloadQuran(version, total)}
            />
          )}
        </View>
      </Card>
    );
  }

  if (status.state !== 'ready') return null;
  if (!results.length) {
    return compact ? null : (
      <Card>
        <AppText variant="label" color="textSecondary" align="center">
          {t('search.noResults')}
        </AppText>
      </Card>
    );
  }

  const surahName = (id: number) => {
    const surah = meta.data?.surahs.find((item) => item.id === id);
    if (!surah) return String(id);
    return i18n.language === 'ar' ? surah.name_arabic : surah.name_simple;
  };

  return (
    <View style={styles.gap}>
      <SearchGroupCard
        title={t('search.groups.quran')}
        items={results.map((ayah) => ({
          id: ayah.key,
          title: ayah.text,
          subtitle: t('search.ayahRef', {
            surah: surahName(ayah.surah),
            ayah: format.digits(ayah.ayah),
            page: format.digits(ayah.page),
          }),
          arabic: true,
          href: { pathname: '/quran/[page]', params: { page: String(ayah.page) } },
        }))}
        quranFont={QURAN_FONT}
      />
      {count > results.length ? (
        <AppText variant="caption" color="textSecondary" align="center">
          {t('search.quranMore', { shown: format.number(results.length), total: format.number(count) })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
});
