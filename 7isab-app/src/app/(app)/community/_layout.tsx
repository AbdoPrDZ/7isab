import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function CommunityLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerBackTitle: t('back'),
      }}>
      <Stack.Screen
        name="feed"
        options={{
          title: t('community.feed'),
          headerShown: true,
        }}
      />
    </Stack>
  );
}
