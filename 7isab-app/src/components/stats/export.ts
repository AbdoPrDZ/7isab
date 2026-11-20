/**
 * CSV export of the filtered entries: one row per entry line (date, kind,
 * description, person, note, account, amount, currency, amount in the main
 * currency). Written to the cache folder and handed to the share sheet. The
 * file is plain text: it leaves the encrypted vault (the screen warns first).
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import i18n from '@/i18n';
import type { Account } from '@/lib/ledger/types';
import { balanceInMain } from '@/lib/wallet/wallet';

import type { Panel } from './use-panel';

function cell(value: string | number | undefined | null): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportCsv(panel: Panel): Promise<void> {
  const accountName = (account: Account) => (account.fixed ? i18n.t(`accounts.${account.fixed}`) : account.name);
  const header = ['date', 'kind', 'description', 'person', 'note', 'account', 'amount', 'currency', `amount_${panel.money.main}`];
  const rows = [header.join(',')];
  for (const entry of [...panel.entries].reverse()) {
    for (const line of entry.lines) {
      const account = panel.ctx.accounts.get(line.account);
      const currency = account
        ? (panel.ctx.currencyOf(account) ?? (account.unit.kind === 'akhira' ? 'AKHIRA_PTS' : 'THANB_PTS'))
        : '';
      const main = account ? balanceInMain(account, line.amount, panel.money.main, panel.money.rates) : null;
      rows.push(
        [
          entry.date,
          i18n.t(`hisab.kinds.${entry.kind}`),
          panel.ctx.describe(entry),
          entry.person,
          entry.note,
          account ? accountName(account) : line.account,
          line.amount,
          currency,
          main ?? '',
        ]
          .map(cell)
          .join(','),
      );
    }
  }
  const file = new File(Paths.cache, `7isab-${panel.range.start}_${panel.range.end}.csv`);
  if (file.exists) file.delete();
  // BOM so spreadsheet apps read Arabic text as UTF-8.
  file.write(`﻿${rows.join('\r\n')}`);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: i18n.t('stats.export.title'), UTI: 'public.comma-separated-values-text' });
}
