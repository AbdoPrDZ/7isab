import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { QURAN_FONT } from '@/components/quran/mushaf-page';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { BookIcon } from '@/components/ui/icons';
import { Chips } from '@/components/ui/layout';
import { useFormat } from '@/lib/format';
import { divisionStartPage, hasDivisions } from '@/lib/quran/divisions';
import { useQuranMeta } from '@/lib/quran/hooks';
import { TOTAL_PAGES, useReadingState } from '@/lib/quran/reading';
import type { QuranMeta, Surah } from '@/lib/quran/types';

type ListMode = 'surah' | 'juz' | 'hizb';

function openPage(page: number) {
  router.push({ pathname: '/quran/[page]', params: { page: String(page) } });
}

/** The surah being read at the start of a page. */
function surahAt(meta: QuranMeta, page: number): Surah | undefined {
  return meta.surahs.filter((surah) => surah.page_start <= page).at(-1);
}

function NumberBadge({ value }: { value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.number, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
      <AppText variant="label" weight="semibold" color="primary" align="center">
        {value}
      </AppText>
    </View>
  );
}

function JuzRow({ meta, juz, page }: { meta: QuranMeta; juz: number; page: number }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const surah = surahAt(meta, page);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPage(page)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}>
      <NumberBadge value={format.number(juz)} />
      <View style={styles.rowText}>
        <AppText variant="heading">{t('quran.juzName', { number: format.number(juz) })}</AppText>
        <AppText variant="caption" color="textSecondary">
          {surah ? `${i18n.language === 'ar' ? surah.name_arabic : surah.name_simple} · ` : ''}
          {t('quran.page', { page: format.digits(page) })}
        </AppText>
      </View>
    </Pressable>
  );
}

/** A hizb and its 8 eighths (thumn); the eighths that start a quarter (rub') are bold. */
function HizbRow({ meta, hizb }: { meta: QuranMeta; hizb: number }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const page = divisionStartPage('hizb', hizb) ?? 1;
  const surah = surahAt(meta, page);
  return (
    <View style={[styles.row, styles.hizbRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable accessibilityRole="button" onPress={() => openPage(page)} style={styles.hizbHead}>
        <NumberBadge value={format.number(hizb)} />
        <View style={styles.rowText}>
          <AppText variant="heading">{t('quran.hizbName', { number: format.number(hizb) })}</AppText>
          <AppText variant="caption" color="textSecondary">
            {surah ? `${i18n.language === 'ar' ? surah.name_arabic : surah.name_simple} · ` : ''}
            {t('quran.page', { page: format.digits(page) })}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.eighths}>
        {Array.from({ length: 8 }, (_, index) => {
          const eighth = (hizb - 1) * 8 + index + 1;
          const startsQuarter = index % 2 === 0;
          const target = divisionStartPage('thumn', eighth) ?? page;
          return (
            <Pressable
              key={eighth}
              accessibilityRole="button"
              accessibilityLabel={
                startsQuarter
                  ? t('quran.rubLabel', { hizb: format.number(hizb), rub: format.number(index / 2 + 1) })
                  : t('quran.thumnLabel', { hizb: format.number(hizb), thumn: format.number(index + 1) })
              }
              onPress={() => openPage(target)}
              style={({ pressed }) => [
                styles.eighth,
                {
                  backgroundColor: pressed ? theme.surfaceMuted : startsQuarter ? theme.primarySoft : theme.background,
                  borderColor: startsQuarter ? theme.primary : theme.border,
                },
              ]}>
              <AppText
                variant="caption"
                weight={startsQuarter ? 'bold' : 'regular'}
                color={startsQuarter ? 'primary' : 'text'}>
                {format.number(index + 1)}
              </AppText>
              <AppText variant="caption" color="textSecondary" style={styles.eighthPage}>
                {startsQuarter ? t('quran.rubShort') : format.digits(target)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SurahRow({ surah }: { surah: Surah }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const number = new Intl.NumberFormat(i18n.language).format(surah.id);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/quran/[page]', params: { page: String(surah.page_start) } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceMuted : theme.surface, borderColor: theme.border },
      ]}>
      <NumberBadge value={number} />
      <View style={styles.rowText}>
        <AppText variant="heading">{i18n.language === 'ar' ? surah.name_arabic : surah.name_simple}</AppText>
        <AppText variant="caption" color="textSecondary">
          {surah.revelation_place === 'makkah' ? t('quran.meccan') : t('quran.medinan')} ·{' '}
          {t('quran.surahMeta', { verses: surah.verses_count, page: surah.page_start })}
        </AppText>
      </View>
      <Text style={[styles.arabicName, { color: theme.primary, fontFamily: QURAN_FONT }]}>{surah.name_arabic}</Text>
    </Pressable>
  );
}

/** Resume card: reading position, khatma progress and totals. */
function ReadingProgress() {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const reading = useReadingState();
  const page = reading?.page ?? 1;
  const doc = reading?.doc;
  const percent = doc ? Math.floor((doc.pagesDone / TOTAL_PAGES) * 100) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/quran/[page]', params: { page: String(page) } })}
      style={({ pressed }) => [
        styles.progress,
        { backgroundColor: theme.accentSoft, borderColor: theme.accent, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.progressTop}>
        <BookIcon size={26} color={theme.primary} />
        <View style={styles.rowText}>
          <AppText variant="heading">{t('reading.resume', { page: format.digits(page) })}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('reading.khatma', { percent: format.digits(percent) })} ·{' '}
            {t('reading.wordsToday', { words: format.number(reading?.wordsToday ?? 0) })}
          </AppText>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: theme.surface }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.primary }]} />
      </View>
      <View style={styles.stats}>
        {[
          [t('reading.words'), format.number(doc?.totalWords ?? 0)],
          [t('reading.pages'), format.number(doc?.pagesDone ?? 0)],
          [t('reading.juz'), format.number(Math.floor((doc?.pagesDone ?? 0) / 20))],
          [t('reading.khatmas'), format.number(doc?.khatmas ?? 0)],
        ].map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <AppText variant="label" weight="bold" color="primary" align="center">
              {value}
            </AppText>
            <AppText variant="caption" color="textSecondary" align="center">
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default function QuranIndexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { direction } = useDirection();
  const { data: meta, loading, error, retry } = useQuranMeta();
  const [mode, setMode] = useState<ListMode>('surah');

  const header = (
    <>
      <ReadingProgress />
      <Chips
        options={(['surah', 'juz', 'hizb'] as ListMode[]).map((value) => ({ value, label: t(`quran.lists.${value}`) }))}
        value={mode}
        onChange={setMode}
      />
      {mode === 'hizb' && meta && !hasDivisions() ? (
        <AppText variant="caption" color="textSecondary" align="center">
          {t('quran.noDivisions')}
        </AppText>
      ) : null}
      {mode === 'hizb' && hasDivisions() ? (
        <AppText variant="caption" color="textSecondary" align="center">
          {t('quran.hizbHint')}
        </AppText>
      ) : null}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, direction }]}>
      <ScreenHeader title={t('quran.title')} subtitle={t('quran.surahs')} />

      {meta ? (
        mode === 'surah' ? (
          <FlatList
            key="surah"
            data={meta.surahs}
            keyExtractor={(surah) => String(surah.id)}
            renderItem={({ item }) => <SurahRow surah={item} />}
            ListHeaderComponent={header}
            contentContainerStyle={[styles.list, { paddingBottom: Spacing.four }]}
            initialNumToRender={20}
          />
        ) : mode === 'juz' ? (
          <FlatList
            key="juz"
            data={meta.juz_starts}
            keyExtractor={(item) => String(item.juz)}
            renderItem={({ item }) => <JuzRow meta={meta} juz={item.juz} page={item.page} />}
            ListHeaderComponent={header}
            contentContainerStyle={[styles.list, { paddingBottom: Spacing.four }]}
            initialNumToRender={15}
          />
        ) : (
          <FlatList
            key="hizb"
            data={hasDivisions() ? Array.from({ length: 60 }, (_, index) => index + 1) : []}
            keyExtractor={(hizb) => String(hizb)}
            renderItem={({ item }) => <HizbRow meta={meta} hizb={item} />}
            ListHeaderComponent={header}
            contentContainerStyle={[styles.list, { paddingBottom: Spacing.four }]}
            initialNumToRender={8}
          />
        )
      ) : (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.primary} /> : null}
          <AppText variant="label" color={error ? 'danger' : 'textSecondary'} align="center">
            {error ? t('quran.loadError') : t('quran.loading')}
          </AppText>
          {error ? <Button title={t('quran.retry')} variant="secondary" onPress={retry} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  hizbRow: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.two },
  hizbHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  eighths: { flexDirection: 'row', gap: 4 },
  eighth: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: Radius.small, borderWidth: 1 },
  eighthPage: { fontSize: 10 },
  number: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  progress: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  progressTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1 },
  arabicName: {
    fontSize: 22,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
});
