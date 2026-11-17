import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { FontFamilies, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { QuranPage, QuranWord, Surah } from '@/lib/quran/types';

export const QURAN_FONT = 'AmiriQuran_400Regular';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const LINES_PER_PAGE = 15;
const PAGE_PADDING = Spacing.three;
/**
 * Amiri Quran's line box is tall above the letters (ascent 1.82 em, descent
 * 0.63 em), so a word's box center sits about 0.6 em above the baseline while
 * the letters' visual center is about 0.3 em above it. Markers are centered on
 * the line, so they're moved down by the difference to sit in the middle of
 * the text.
 */
const MARKER_DROP = 0.3;
/**
 * Height of a line's text box, in em. Amiri Quran draws up to ~2.8 em
 * (Windows ascent 1.86 + descent 0.91). Android caps a text view at the
 * height its parent offers and clips anything outside it, so each line gets
 * a box this tall, centred on its slot with negative margins: it overlaps the
 * neighbouring slots instead of clipping, and the page layout is unchanged.
 */
const TEXT_BOX_EM = 2.9;

/** Style for a line: the slot height on the page, with a taller box for the glyphs. */
function lineBox(slot: number, fontSize: number) {
  const box = Math.max(slot, fontSize * TEXT_BOX_EM);
  return { height: box, marginVertical: (slot - box) / 2 };
}
/**
 * Text scale of each line, per page and size, from the measuring pass. Kept for the whole app
 * run, so a page is only measured the first time it's shown.
 */
const fitCache = new Map<string, number[]>();
/** Smallest space between words, as a fraction of the font size. */
const WORD_GAP = 0.12;
/** Al-Fatiha and the start of Al-Baqarah are laid out as short, centered pages. */
const OPENING_PAGES = 2;
const ARABIC_DIGITS = new Intl.NumberFormat('ar-EG', { useGrouping: false });

type MushafPageProps = {
  page: QuranPage;
  surahs: Surah[];
  width: number;
  /** The page's lines are spread over this height. */
  height: number;
  /** Tap reading: index of the highlighted word among the page's words (markers excluded). */
  highlight?: number;
};

type LineContent =
  { kind: 'words'; words: QuranWord[] } | { kind: 'header'; surah: Surah } | { kind: 'bismillah' } | { kind: 'empty' };

/** Works out what each of the page's lines shows. */
function layoutLines(page: QuranPage, surahs: Surah[]): LineContent[] {
  const opening = page.number <= OPENING_PAGES;
  const lastLine = opening ? Math.max(...page.lines.map((line) => line.line)) : LINES_PER_PAGE;
  const content = new Map<number, LineContent>();

  for (const line of page.lines) {
    content.set(line.line, { kind: 'words', words: line.words });
  }

  // The empty line(s) right before a surah's first ayah hold its header and Bismillah.
  for (const start of page.surah_starts) {
    const surah = surahs.find((item) => item.id === start.surah_id);
    if (!surah) continue;
    let line = start.line - 1;
    if (surah.bismillah_pre && line >= 1 && !content.has(line)) {
      content.set(line, { kind: 'bismillah' });
      line -= 1;
    }
    if (line >= 1 && !content.has(line)) {
      content.set(line, { kind: 'header', surah });
    }
  }

  const firstLine = opening ? Math.min(...content.keys()) : 1;
  const lines: LineContent[] = [];
  for (let line = firstLine; line <= lastLine; line++) {
    lines.push(content.get(line) ?? { kind: 'empty' });
  }
  return lines;
}

/** The ayah number from its key ("2:255" → "٢٥٥"), in Arabic-Indic digits. */
function ayahNumber(word: QuranWord): string {
  const ayah = Number(word.key.split(':')[1]);
  return Number.isFinite(ayah) ? ARABIC_DIGITS.format(ayah) : word.text;
}

/**
 * End-of-ayah ornament: a double gold ring with the number centered in it.
 * Drawn with plain Views (not SVG) because a page can have 20+ of them and
 * they're rendered on every page switch. The number uses IBM Plex Sans Arabic,
 * whose metrics center reliably (the Quran font's tall line box doesn't).
 */
const AyahMarker = memo(function AyahMarker({
  number,
  size,
  offsetY,
}: {
  number: string;
  size: number;
  offsetY: number;
}) {
  const theme = useTheme();
  const digitSize = size * (number.length >= 3 ? 0.34 : 0.42);
  const ring = size * 0.12;

  return (
    <View
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginHorizontal: size * 0.06,
          borderColor: theme.accent,
          backgroundColor: theme.accentSoft,
          transform: [{ translateY: offsetY }],
        },
      ]}>
      <View
        style={[
          styles.markerInner,
          { top: ring, left: ring, right: ring, bottom: ring, borderRadius: size / 2, borderColor: theme.accent },
        ]}
      />
      <Text
        allowFontScaling={false}
        style={[
          styles.markerText,
          {
            fontSize: digitSize,
            lineHeight: digitSize * 1.3,
            color: theme.primary,
            fontFamily: FontFamilies.arabic.semibold,
          },
        ]}>
        {number}
      </Text>
    </View>
  );
});

/** A small gold eight-point star, used on both ends of the surah banner. */
function Ornament({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2l2.6 4.3L19.1 4.9 17.7 9.4 22 12l-4.3 2.6 1.4 4.5-4.5-1.4L12 22l-2.6-4.3-4.5 1.4 1.4-4.5L2 12l4.3-2.6-1.4-4.5 4.5 1.4z"
        fill={color}
      />
      <Circle cx="12" cy="12" r="3" fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
    </Svg>
  );
}

/**
 * Surah title banner: a double gold frame with a star on each end. The name
 * uses IBM Plex Sans Arabic so it stays vertically centered (the Quran font's
 * tall line box pushes text down and gets clipped).
 */
function SurahHeader({ name, height }: { name: string; height: number }) {
  const theme = useTheme();
  const textSize = height * 0.42;

  return (
    <View style={[styles.header, { height, borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
      <View style={[styles.headerInner, { borderColor: theme.accent }]}>
        <Ornament size={height * 0.45} color={theme.accent} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.headerText,
            {
              fontSize: textSize,
              lineHeight: textSize * 1.35,
              color: theme.primary,
              fontFamily: FontFamilies.arabic.semibold,
            },
          ]}>
          سورة {name}
        </Text>
        <Ornament size={height * 0.45} color={theme.accent} />
      </View>
    </View>
  );
}

/** The page's words in reading order, without ayah-number markers (what tap reading counts). */
export function pageWords(page: QuranPage): string[] {
  return page.lines.flatMap((line) => line.words.filter((word) => word.type === 'word').map((word) => word.text));
}

/** Ayah key of each word from pageWords, in the same order (for hizb / rub' / thumn counting). */
export function pageWordKeys(page: QuranPage): string[] {
  return page.lines.flatMap((line) => line.words.filter((word) => word.type === 'word').map((word) => word.key));
}

type WordLineProps = {
  words: QuranWord[];
  fontSize: number;
  height: number;
  centered: boolean;
  /** Index of the highlighted word within this line (words only), or -1. */
  highlight: number;
};

/**
 * One line of words. Memoized so tap reading (which moves the highlight)
 * re-renders only the line(s) whose highlight changed.
 */
const WordLine = memo(function WordLine({ words, fontSize, height, centered, highlight }: WordLineProps) {
  const theme = useTheme();
  const textStyle = { fontFamily: QURAN_FONT, fontSize, color: theme.text };
  let wordIndex = -1;

  return (
    <View
      style={[
        styles.line,
        { ...lineBox(height, fontSize), columnGap: fontSize * WORD_GAP },
        centered ? styles.lineCentered : styles.lineJustified,
      ]}>
      {words.map((word) => {
        if (word.type === 'end') {
          return (
            <AyahMarker
              key={`${word.key}-${word.position}`}
              number={ayahNumber(word)}
              size={fontSize * 1.3}
              offsetY={fontSize * MARKER_DROP}
            />
          );
        }
        wordIndex++;
        const active = wordIndex === highlight;
        return (
          <Text
            key={`${word.key}-${word.position}`}
            style={[textStyle, active && { backgroundColor: theme.accentSoft, color: theme.primary, borderRadius: 6 }]}
            allowFontScaling={false}>
            {word.text}
          </Text>
        );
      })}
    </View>
  );
});

/** One mushaf page. Quran text is always right-to-left, whatever the UI language. */
export const MushafPage = memo(function MushafPage({ page, surahs, width, height, highlight = -1 }: MushafPageProps) {
  const theme = useTheme();
  const opening = page.number <= OPENING_PAGES;
  const lines = layoutLines(page, surahs);

  // Each page is built in two steps before it's shown:
  // 1. every line is laid out invisibly at the base size to measure its natural width;
  // 2. each line gets its own scale (only lines too wide for the page shrink), then
  //    the page is displayed. Shrinking only the dense lines keeps the rest of the
  //    page at full size (one dense line used to shrink the whole page).
  // The opening pages use the same size, with their few lines grouped in the center.
  const slot = height / LINES_PER_PAGE;
  const baseFontSize = Math.min(30, width / 15, slot / 1.55);
  const measureKey = `${page.number}:${Math.round(width)}:${Math.round(height)}`;
  const [, setMeasuredKey] = useState('');
  // Line widths from the measuring pass, keyed by "<measureKey>|<line index>".
  const [measured] = useState(() => new Map<string, number>());
  const wordLines = lines.flatMap((line, index) => (line.kind === 'words' ? [index] : []));
  const scales = wordLines.length === 0 ? [] : (fitCache.get(measureKey) ?? null);

  const onMeasureLine = (index: number, lineWidth: number) => {
    measured.set(`${measureKey}|${index}`, lineWidth);
    if (wordLines.every((line) => measured.has(`${measureKey}|${line}`))) {
      const available = width - PAGE_PADDING * 2;
      fitCache.set(
        measureKey,
        lines.map((_, line) => {
          const natural = measured.get(`${measureKey}|${line}`) ?? 0;
          return natural > 0 ? Math.min(1, (available / natural) * 0.98) : 1;
        }),
      );
      setMeasuredKey(measureKey);
    }
  };

  const textStyleFor = (fontSize: number) => ({ fontFamily: QURAN_FONT, fontSize, color: theme.text });

  // No fixed lineHeight on the words: the text box then uses the font's own (tall)
  // ascent and descent, so deep letters like ي and ن aren't clipped. Words may
  // overflow their line slot a little; the line View doesn't clip, so that's fine.
  const renderWords = (words: QuranWord[], fontSize: number) => {
    const textStyle = textStyleFor(fontSize);
    return words.map((word) =>
      word.type === 'end' ? (
        <AyahMarker
          key={`${word.key}-${word.position}`}
          number={ayahNumber(word)}
          size={fontSize * 1.3}
          offsetY={fontSize * MARKER_DROP}
        />
      ) : (
        <Text key={`${word.key}-${word.position}`} style={textStyle} allowFontScaling={false}>
          {word.text}
        </Text>
      ),
    );
  };

  // Step 1: measure every line at its natural width, invisibly (nothing is shown yet).
  if (scales === null) {
    return (
      <View style={[styles.page, { width, height, direction: 'rtl' }]}>
        <View style={[styles.measureLayer, { width: width * 4 }]} pointerEvents="none">
          {lines.map((line, index) =>
            line.kind === 'words' ? (
              <View
                key={index}
                style={[styles.line, styles.measureLine, { gap: baseFontSize * WORD_GAP }]}
                onLayout={(event) => onMeasureLine(index, event.nativeEvent.layout.width)}>
                {renderWords(line.words, baseFontSize)}
              </View>
            ) : null,
          )}
        </View>
      </View>
    );
  }

  const fontSize = baseFontSize;
  const textStyle = textStyleFor(fontSize);
  // Where each line's words start in the page's word order (for the highlight).
  const wordOffsets: number[] = [];
  lines.reduce((offset, line, index) => {
    wordOffsets[index] = offset;
    return line.kind === 'words' ? offset + line.words.filter((word) => word.type === 'word').length : offset;
  }, 0);

  const renderLine = (line: LineContent, index: number): ReactNode => {
    const lineStyle = { height: slot };
    switch (line.kind) {
      case 'words': {
        const start = wordOffsets[index];
        const count = line.words.filter((word) => word.type === 'word').length;
        return (
          <WordLine
            key={index}
            words={line.words}
            fontSize={baseFontSize * (scales[index] ?? 1)}
            height={slot}
            centered={opening}
            highlight={highlight >= start && highlight < start + count ? highlight - start : -1}
          />
        );
      }
      case 'header':
        return (
          <View key={index} style={[lineStyle, styles.headerSlot]}>
            <SurahHeader name={line.surah.name_arabic} height={Math.min(slot * 0.86, fontSize * 2.2)} />
          </View>
        );
      case 'bismillah':
        return (
          <View key={index} style={[styles.line, styles.lineCentered, lineBox(slot, fontSize)]}>
            <Text style={textStyle} allowFontScaling={false}>
              {BISMILLAH}
            </Text>
          </View>
        );
      default:
        return <View key={index} style={lineStyle} />;
    }
  };

  return (
    <View style={[styles.page, { width, height, direction: 'rtl' }, opening && styles.pageOpening]}>
      {lines.map(renderLine)}
    </View>
  );
});

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: PAGE_PADDING,
  },
  measureLayer: {
    position: 'absolute',
    top: 0,
    opacity: 0,
  },
  measureLine: {
    alignSelf: 'flex-start',
  },
  pageOpening: {
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  lineJustified: {
    justifyContent: 'space-between',
  },
  lineCentered: {
    justifyContent: 'center',
    gap: Spacing.two,
  },
  headerSlot: {
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.small,
    padding: 3,
  },
  headerInner: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.8,
    borderRadius: Radius.small - 3,
    paddingHorizontal: Spacing.two,
  },
  headerText: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  markerInner: {
    position: 'absolute',
    borderWidth: 0.8,
  },
  markerText: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
