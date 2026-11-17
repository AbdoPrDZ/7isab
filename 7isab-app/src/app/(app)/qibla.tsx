import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui/app-text';
import { Card, Screen } from '@/components/ui/layout';
import { useTheme } from '@/hooks/use-theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { distanceToKaaba, qiblaBearing, usePrayerSettings } from '@/lib/prayer/prayer';

const SIZE = 280;
const R = SIZE / 2;
/** Facing the qibla within this many degrees counts as "facing". */
const ON_TARGET = 4;

type Heading = { degrees: number; accuracy: number } | null;

/** Smallest signed angle from a to b, in −180…180. */
function angleBetween(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Compass pointing to the Kaaba: the rose turns with the phone; the top marker is where the phone points. */
export default function QiblaScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const settings = usePrayerSettings();
  const [heading, setHeading] = useState<Heading>(null);
  const [unavailable, setUnavailable] = useState(false);
  const location = settings.location;

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let active = true;
    Location.watchHeadingAsync((value) => {
      if (!active) return;
      const degrees = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
      setHeading({ degrees, accuracy: value.accuracy });
    })
      .then((sub) => {
        if (active) subscription = sub;
        else sub.remove();
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  if (!location) {
    return (
      <Screen back title={t('prayer.qibla')}>
        <AppText variant="label" color="textSecondary" align="center">
          {t('prayer.setupHint')}
        </AppText>
      </Screen>
    );
  }

  const qibla = qiblaBearing(location);
  const phone = heading?.degrees ?? 0;
  const offset = angleBetween(phone, qibla);
  const facing = heading !== null && Math.abs(offset) <= ON_TARGET;
  const marker = facing ? theme.primary : theme.accent;

  // Position of the Kaaba mark on the (rotating) rose.
  const rad = ((qibla - 90) * Math.PI) / 180;
  const kx = R + Math.cos(rad) * (R - 34);
  const ky = R + Math.sin(rad) * (R - 34);

  return (
    <Screen back title={t('prayer.qibla')} subtitle={location.city ?? undefined}>
      <View style={styles.center}>
        <Svg width={SIZE} height={SIZE + 16}>
          {/* Fixed marker: where the top of the phone points. */}
          <Path d={`M${R - 10} 2 L${R + 10} 2 L${R} 18 Z`} fill={marker} />
          <G transform={`translate(0 16) rotate(${-phone} ${R} ${R})`}>
            <Circle cx={R} cy={R} r={R - 4} fill={theme.surface} stroke={theme.border} strokeWidth={2} />
            {Array.from({ length: 72 }, (_, index) => {
              const angle = index * 5;
              const a = ((angle - 90) * Math.PI) / 180;
              const long = angle % 30 === 0;
              const inner = R - (long ? 20 : 12);
              return (
                <Line
                  key={angle}
                  x1={R + Math.cos(a) * inner}
                  y1={R + Math.sin(a) * inner}
                  x2={R + Math.cos(a) * (R - 6)}
                  y2={R + Math.sin(a) * (R - 6)}
                  stroke={theme.textSecondary}
                  strokeWidth={long ? 2 : 1}
                />
              );
            })}
            {(['N', 'E', 'S', 'W'] as const).map((point, index) => {
              const a = ((index * 90 - 90) * Math.PI) / 180;
              return (
                <SvgText
                  key={point}
                  x={R + Math.cos(a) * (R - 38)}
                  y={R + Math.sin(a) * (R - 38) + 6}
                  fill={point === 'N' ? theme.danger : theme.text}
                  fontSize={18}
                  fontWeight="bold"
                  textAnchor="middle">
                  {t(`prayer.compass.${point}`)}
                </SvgText>
              );
            })}
            {/* Line from the centre to the Kaaba. */}
            <Line x1={R} y1={R} x2={kx} y2={ky} stroke={marker} strokeWidth={4} strokeLinecap="round" />
            <G transform={`translate(${kx - 13} ${ky - 13})`}>
              <Path d="M3 7 L13 3 L23 7 L23 23 L3 23 Z" fill={theme.text} />
              <Path d="M3 11 L23 11" stroke={theme.accent} strokeWidth={2.5} />
            </G>
            <Circle cx={R} cy={R} r={6} fill={marker} />
          </G>
        </Svg>
      </View>

      <Card tone={facing ? 'accent' : 'surface'}>
        <AppText variant="heading" align="center" color={facing ? 'primary' : 'text'}>
          {heading === null
            ? t('prayer.qiblaBearing', { degrees: format.number(Math.round(qibla)) })
            : facing
              ? t('prayer.facingQibla')
              : t(offset > 0 ? 'prayer.turnRight' : 'prayer.turnLeft', { degrees: format.number(Math.round(Math.abs(offset))) })}
        </AppText>
        <AppText variant="caption" color="textSecondary" align="center">
          {t('prayer.qiblaInfo', {
            degrees: format.number(Math.round(qibla)),
            km: format.number(Math.round(distanceToKaaba(location))),
          })}
        </AppText>
        {unavailable ? (
          <AppText variant="caption" color="danger" align="center">
            {t('prayer.noCompass')}
          </AppText>
        ) : heading && heading.accuracy < 2 ? (
          <AppText variant="caption" color="danger" align="center">
            {t('prayer.calibrate')}
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
});
