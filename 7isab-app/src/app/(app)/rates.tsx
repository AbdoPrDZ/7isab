import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, useFontFamily } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Divider, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { newId, putDoc, removeDoc } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { useExchangeRates, useSettings } from '@/lib/ledger/hooks';
import { updateSettings } from '@/lib/ledger/ledger';
import { GOLD_CURRENCY, RecordTypes, type ExchangeRate, type Rates } from '@/lib/ledger/types';

/** A number field that saves when editing ends. */
function NumberRow({ label, value, onSave }: { label: string; value: number; onSave: (value: number) => void }) {
  const theme = useTheme();
  const fontFamily = useFontFamily('semibold');
  const [text, setText] = useState(String(value));

  return (
    <View style={styles.numberRow}>
      <AppText variant="label" style={styles.flex}>
        {label}
      </AppText>
      <TextInput
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        onEndEditing={() => {
          const parsed = parseAmount(text);
          if (parsed !== null && parsed >= 0) onSave(parsed);
          else setText(String(value));
        }}
        style={[styles.input, { borderColor: theme.border, color: theme.text, fontFamily }]}
      />
    </View>
  );
}

export default function RatesScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const exchangeRates = useExchangeRates();
  const [currency, setCurrency] = useState('');

  if (!settings) return null;
  const main = settings.mainCurrency;
  const saveRate = (key: keyof Rates) => (value: number) =>
    void updateSettings({ rates: { ...settings.rates, [key]: value } });

  const addCurrency = () => {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || exchangeRates.some((rate) => rate.currency === code) || code === main) return;
    void putDoc<ExchangeRate>(RecordTypes.exchangeRate, { id: newId(), currency: code, rate: 1 });
    setCurrency('');
  };

  const sorted = [...exchangeRates].sort((a, b) =>
    a.currency === GOLD_CURRENCY ? -1 : b.currency === GOLD_CURRENCY ? 1 : a.currency.localeCompare(b.currency),
  );
  const hasGold = exchangeRates.some((rate) => rate.currency === GOLD_CURRENCY);

  return (
    <Screen back title={t('rates.title')} subtitle={t('rates.subtitle')}>
      <Card>
        <NumberRow label={t('rates.sadaqa', { currency: main })} value={settings.rates.sadaqa} onSave={saveRate('sadaqa')} />
        <Divider />
        <NumberRow label={t('rates.zakat', { currency: main })} value={settings.rates.zakat} onSave={saveRate('zakat')} />
        <Divider />
        <NumberRow label={t('rates.thanbCost', { currency: main })} value={settings.rates.thanbCost} onSave={saveRate('thanbCost')} />
        <Divider />
        <NumberRow label={t('rates.thanbReward')} value={settings.rates.thanbReward} onSave={saveRate('thanbReward')} />
        <Divider />
        <NumberRow label={t('rates.fastTap')} value={settings.rates.fastTap} onSave={saveRate('fastTap')} />
      </Card>

      <Section title={t('rates.strictness')}>
        <Chips
          options={[0, 1, 2, 3].map((value) => ({ value, label: t(`rates.strictnessLevels.${value}`) }))}
          value={settings.fastTapStrictness}
          onChange={(value) => void updateSettings({ fastTapStrictness: value })}
        />
      </Section>

      <Section title={t('rates.exchange')}>
        <AppText variant="caption" color="textSecondary">
          {t('rates.exchangeHint', { main })}
        </AppText>
        <Card>
          {sorted.map((rate, index) => (
            <Fragment key={rate.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onLongPress={() =>
                  Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => void removeDoc(RecordTypes.exchangeRate, rate.id) },
                  ])
                }>
                <NumberRow
                  label={rate.currency === GOLD_CURRENCY ? t('rates.gold') : `1 ${rate.currency} =`}
                  value={rate.rate}
                  onSave={(value) => void putDoc<ExchangeRate>(RecordTypes.exchangeRate, { ...rate, rate: value })}
                />
              </Pressable>
            </Fragment>
          ))}
          {!hasGold ? (
            <Button
              title={`${t('common.add')} · ${t('rates.gold')}`}
              variant="ghost"
              onPress={() => void putDoc<ExchangeRate>(RecordTypes.exchangeRate, { id: newId(), currency: GOLD_CURRENCY, rate: 1 })}
            />
          ) : null}
        </Card>
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField
              label={t('rates.currency')}
              placeholder="EUR"
              value={currency}
              maxLength={3}
              autoCapitalize="characters"
              onChangeText={setCurrency}
            />
          </View>
          <Button title={t('rates.addCurrency')} variant="secondary" onPress={addCurrency} style={styles.addButton} />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  input: {
    width: 84,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    textAlign: 'center',
    fontSize: 15,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  addButton: { minHeight: 52 },
});
