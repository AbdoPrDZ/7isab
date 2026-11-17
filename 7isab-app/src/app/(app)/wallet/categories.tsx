import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, useFontFamily } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Divider, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthOf, today } from '@/lib/dates';
import { removeDoc } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { useAccounts, useEntries, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes } from '@/lib/ledger/types';
import type { Budget, Category } from '@/lib/wallet/types';
import { CATEGORY_COLORS, saveCategory, setBudget, spendingByCategory, useBudgets, useCategories } from '@/lib/wallet/wallet';

function BudgetInput({ category, budgets }: { category: Category; budgets: Budget[] }) {
  const theme = useTheme();
  const fontFamily = useFontFamily('semibold');
  const budget = budgets.find((item) => item.categoryId === category.id);
  const [text, setText] = useState(budget ? String(budget.amount) : '');

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      placeholder="—"
      placeholderTextColor={theme.textSecondary}
      keyboardType="decimal-pad"
      onEndEditing={() => void setBudget(category.id, parseAmount(text), budgets)}
      style={[styles.budget, { borderColor: theme.border, color: theme.text, fontFamily }]}
    />
  );
}

/** Categories (with sub-categories) and monthly budgets per category. */
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const categories = useCategories();
  const budgets = useBudgets();
  const entries = useEntries();
  const accounts = useAccounts();
  const rates = useExchangeRates();
  const { format, mainCurrency } = useLedgerLabels();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  const spent = spendingByCategory(entries, accounts, monthOf(today()), mainCurrency, rates);
  const label = (category: Category) => (category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name);
  const roots = categories.filter((category) => !category.parentId);
  const childrenOf = (id: string) => categories.filter((category) => category.parentId === id);

  const add = async () => {
    if (!name.trim()) return;
    await saveCategory({ name: name.trim(), kind, color, parentId: parentId || undefined, order: categories.length });
    setName('');
  };

  const remove = (category: Category) =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void removeDoc(RecordTypes.category, category.id) },
    ]);

  const renderCategory = (category: Category, nested: boolean) => {
    const budget = budgets.find((item) => item.categoryId === category.id);
    const used = spent.get(category.id) ?? 0;
    const over = budget ? used - budget.amount : 0;
    return (
      <Pressable key={category.id} onLongPress={() => remove(category)} style={[styles.row, nested && styles.nested]}>
        <View style={[styles.dot, { backgroundColor: category.color }]} />
        <View style={styles.flex}>
          <AppText variant="label">{label(category)}</AppText>
          {category.kind === 'expense' ? (
            <AppText variant="caption" color={over > 0 ? 'danger' : 'textSecondary'}>
              {budget
                ? over > 0
                  ? t('wallet.overBudget', { amount: format.money(over, mainCurrency) })
                  : t('wallet.budgetLeft', {
                      left: format.money(budget.amount - used, mainCurrency),
                      total: format.money(budget.amount, mainCurrency),
                    })
                : format.money(used, mainCurrency)}
            </AppText>
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('wallet.income')}
            </AppText>
          )}
        </View>
        {category.kind === 'expense' ? <BudgetInput category={category} budgets={budgets} /> : null}
      </Pressable>
    );
  };

  return (
    <Screen back title={t('wallet.categories')} subtitle={t('wallet.budgetFor')}>
      <Card>
        {roots.map((category, index) => (
          <Fragment key={category.id}>
            {index > 0 ? <Divider /> : null}
            {renderCategory(category, false)}
            {childrenOf(category.id).map((child) => renderCategory(child, true))}
          </Fragment>
        ))}
      </Card>

      <Section title={t('wallet.addCategory')}>
        <TextField label={t('wallet.categoryName')} value={name} onChangeText={setName} />
        <Chips
          options={[
            { value: 'expense' as const, label: t('wallet.expense') },
            { value: 'income' as const, label: t('wallet.income') },
          ]}
          value={kind}
          onChange={setKind}
        />
        <AppText variant="label" color="textSecondary">
          {t('wallet.parent')}
        </AppText>
        <Chips
          options={[
            { value: '', label: '—' },
            ...roots.filter((category) => category.kind === kind).map((category) => ({ value: category.id, label: label(category) })),
          ]}
          value={parentId}
          onChange={setParentId}
        />
        <View style={styles.colors}>
          {CATEGORY_COLORS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setColor(value)}
              style={[styles.swatch, { backgroundColor: value, borderColor: color === value ? theme.text : 'transparent' }]}
            />
          ))}
        </View>
        <Button title={t('common.add')} variant="secondary" onPress={() => void add()} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  nested: { paddingStart: Spacing.five },
  dot: { width: 14, height: 14, borderRadius: 7 },
  budget: {
    width: 96,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    textAlign: 'center',
    fontSize: 14,
  },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5 },
});
