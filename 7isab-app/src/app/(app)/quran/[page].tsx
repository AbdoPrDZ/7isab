import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MushafPage, pageWordKeys, pageWords } from '@/components/quran/mushaf-page';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing, Radius } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { UndoIcon } from '@/components/ui/icons';

import { useFormat } from '@/lib/format';
import { divisionAtPage } from '@/lib/quran/divisions';
import { prefetchPages, useQuranMeta, useQuranPage } from '@/lib/quran/hooks';
import { flushReading, tapWord, undoTap, useReadingState, type TapResult } from '@/lib/quran/reading';
import type { QuranMeta } from '@/lib/quran/types';

/** How many pages around the visible one to download ahead. */
const PREFETCH_RADIUS = 2;
const FRAME_BORDER = 2;
const FRAME_PADDING = Spacing.two;
const SLIDE_PADDING = Spacing.three;
const SLIDE_GAP = Spacing.two;
const CAPTION_HEIGHT = 18;

type PageSlideProps = {
  meta: QuranMeta;
  page: number;
  width: number;
  height: number;
  /** Tap reading: taps on the page count the highlighted word. */
  tapMode: boolean;
  onTapResult: (page: number, result: TapResult) => void;
};

/** One page of the reader. Memoized: switching pages must not re-render the other slides. */
const PageSlide = memo(function PageSlide({ meta, page, width, height, tapMode, onTapResult }: PageSlideProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data, loading, error, retry } = useQuranPage(meta.version, page);
  const reading = useReadingState();
  const insets = useSafeAreaInsets();
  const formatter = useFormat();
  const format = { format: (value: number) => formatter.digits(value) };
  const words = useMemo(() => (data ? pageWords(data) : []), [data]);
  const keys = useMemo(() => (data ? pageWordKeys(data) : []), [data]);
  const highlight = tapMode ? (reading && reading.page === page ? reading.word : 0) : -1;
  const bottom = insets.bottom + Spacing.two;
  // The text area's size is worked out from the slide's size, so the page renders
  // in one pass (measuring it with onLayout would render every page twice).
  const textWidth = width - SLIDE_PADDING * 2 - FRAME_BORDER * 2;
  const textHeight =
    height - SLIDE_PADDING - bottom - SLIDE_GAP - CAPTION_HEIGHT - FRAME_BORDER * 2 - FRAME_PADDING * 2;

  return (
    <View style={{ width, height }}>
      {data ? (
        <View style={[styles.slideContent, { paddingBottom: bottom }]}>
          <Pressable
            disabled={!tapMode}
            onPress={() => onTapResult(page, tapWord(page, words, keys))}
            style={[
              styles.frame,
              { borderColor: tapMode ? theme.primary : theme.accent, backgroundColor: theme.surface },
            ]}>
            <MushafPage page={data} surahs={meta.surahs} width={textWidth} height={textHeight} highlight={highlight} />
          </Pressable>
          <View style={styles.caption}>
            <AppText variant="caption" color="textSecondary" align="center" numberOfLines={1}>
              {t('quran.page', { page: format.format(page) })}
              {data.juz ? ` · ${t('quran.juz', { juz: format.format(data.juz) })}` : ''}
            </AppText>
          </View>
        </View>
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
});

/**
 * Mushaf reader: swipe between pages like a printed mushaf (the next page is
 * on the left). Pages are cached on the device after the first load.
 */
export default function QuranReaderScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { direction } = useDirection();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ page: string }>();
  const { data: meta, error, retry } = useQuranMeta();

  const total = meta?.pages ?? 604;
  const startPage = Math.min(Math.max(Number(params.page) || 1, 1), total);
  const [visiblePage, setVisiblePage] = useState(startPage);
  const [listHeight, setListHeight] = useState(0);
  const [tapMode, setTapMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList<number>>(null);
  const reading = useReadingState();
  const format = useFormat();

  // Save the reading position when leaving the reader.
  useEffect(() => () => void flushReading(), []);

  const onTapResult = useCallback(
    (page: number, result: TapResult) => {
      if (result === 'tooFast') setNotice(t('reading.fastWarning'));
      else if (result === 'penalty') setNotice(t('reading.fastPenalty'));
      else setNotice(null);
      // Finished the page: turn to the next one.
      if (result === 'pageDone' && page < total) {
        listRef.current?.scrollToIndex({ index: page, animated: true });
      }
    },
    [t, total],
  );

  const pages = useMemo(() => Array.from({ length: total }, (_, index) => index + 1), [total]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item?: number }[] }) => {
    const first = viewableItems[0]?.item;
    if (typeof first === 'number') setVisiblePage(first);
  }, []);

  useEffect(() => {
    if (!meta) return;
    prefetchPages(
      meta.version,
      Array.from({ length: PREFETCH_RADIUS * 2 + 1 }, (_, index) => visiblePage - PREFETCH_RADIUS + index),
      total,
    );
  }, [meta, visiblePage, total]);

  // The surah shown in the header: the last one starting on or before this page.
  const surah = meta?.surahs.filter((item) => item.page_start <= visiblePage).at(-1);
  // Hizb, rub' and thumn at this page (needs the server's divisions).
  const position = meta ? divisionAtPage(visiblePage) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, direction }]}>
      <ScreenHeader
        title={surah ? `سُورَةُ ${surah.name_arabic}` : t('quran.title')}
        subtitle={[
          t('quran.page', { page: format.digits(visiblePage) }),
          position
            ? t('quran.position', {
                hizb: format.number(position.hizb),
                rub: format.number(position.rub),
                thumn: format.number(position.thumn),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        backLabel={t('settings.back')}
        end={
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: tapMode }}
            onPress={() => {
              setTapMode((value) => !value);
              setNotice(null);
            }}
            style={[styles.modeButton, { backgroundColor: tapMode ? theme.accent : 'rgba(255,255,255,0.14)' }]}>
            <AppText variant="caption" weight="semibold" color={tapMode ? 'hero' : 'onHero'}>
              {t('reading.tapMode')}
            </AppText>
          </Pressable>
        }
      />
      {tapMode ? (
        <View style={[styles.tapBar, { backgroundColor: notice ? theme.dangerSoft : theme.primarySoft }]}>
          <AppText variant="caption" color={notice ? 'danger' : 'primary'} style={styles.flex}>
            {notice ??
              `${t('reading.tapHint')} · ${t('reading.wordsToday', { words: format.number(reading?.wordsToday ?? 0) })}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reading.undo')}
            hitSlop={8}
            onPress={() => undoTap(visiblePage)}>
            <UndoIcon size={22} color={theme.primary} />
          </Pressable>
        </View>
      ) : null}

      {meta ? (
        <View style={styles.listArea} onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
          {listHeight > 0 ? (
            <FlatList
              ref={listRef}
              data={pages}
              keyExtractor={(page) => String(page)}
              renderItem={({ item }) => (
                <PageSlide
                  meta={meta}
                  page={item}
                  width={width}
                  height={listHeight}
                  tapMode={tapMode}
                  onTapResult={onTapResult}
                />
              )}
              extraData={tapMode}
              horizontal
              // Inverted: page 1 on the right, later pages to the left, as in a printed mushaf.
              inverted
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={startPage - 1}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              windowSize={3}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              updateCellsBatchingPeriod={100}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              style={styles.list}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.center}>
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
    // The mushaf is laid out right-to-left regardless of the UI language.
    direction: 'ltr',
  },
  listArea: {
    flex: 1,
  },
  flex: { flex: 1 },
  modeButton: { borderRadius: Radius.small, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  tapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: SLIDE_PADDING,
    paddingTop: SLIDE_PADDING,
    gap: SLIDE_GAP,
  },
  caption: {
    height: CAPTION_HEIGHT,
    justifyContent: 'center',
  },
  frame: {
    flex: 1,
    borderWidth: FRAME_BORDER,
    borderRadius: 18,
    paddingVertical: FRAME_PADDING,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
});
