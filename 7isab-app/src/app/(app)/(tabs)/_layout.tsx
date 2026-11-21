import { Tabs } from 'expo-router/tabs';

import { BeadsIcon, BookIcon, ChartIcon, HomeIcon, WalletIcon } from '@/components/ui/icons';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';

const TABS: TabItem[] = [
  { name: 'index', label: 'tabs.today', Icon: HomeIcon },
  { name: 'quran', label: 'tabs.quran', Icon: BookIcon },
  { name: 'athkar', label: 'tabs.athkar', Icon: BeadsIcon },
  { name: 'wallet', label: 'tabs.wallet', Icon: WalletIcon },
  { name: 'stats', label: 'tabs.stats', Icon: ChartIcon },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} tabs={TABS} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
