import { Tabs } from 'expo-router/tabs';

import { ChatIcon, HomeIcon, PageIcon, PeopleIcon, QuestionIcon } from '@/components/ui/icons';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';

const TABS: TabItem[] = [
  { name: 'index', label: 'community.tabs.home', Icon: HomeIcon },
  { name: 'groups', label: 'community.tabs.groups', Icon: PeopleIcon },
  { name: 'pages', label: 'community.tabs.pages', Icon: PageIcon },
  { name: 'fatwa', label: 'community.tabs.fatwa', Icon: QuestionIcon },
  { name: 'chats', label: 'community.tabs.chats', Icon: ChatIcon },
];

/** The community's own tabs: Home (feed), Groups, Pages, Fatwa, Chats. */
export default function CommunityTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} tabs={TABS} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
