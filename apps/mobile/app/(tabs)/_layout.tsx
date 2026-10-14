import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { useType } from '../../src/ui/typeContext';

type TabIcon = 'sunny' | 'shirt' | 'calendar' | 'settings';

const WEB_TAB_BAR_HEIGHT = 56;

function tabIcon(name: TabIcon) {
  return function Icon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { color: _color, ...tabLabel } = useType().tab;
  const insets = useSafeAreaInsets();
  const webHeight = Platform.OS === 'web' ? { height: WEB_TAB_BAR_HEIGHT + insets.bottom } : null;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.graphite,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          ...webHeight,
        },
        tabBarLabelStyle: tabLabel,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
          tabBarIcon: tabIcon('sunny'),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: t('tabs.closet'),
          tabBarAccessibilityLabel: t('tabs.closet'),
          tabBarIcon: tabIcon('shirt'),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarAccessibilityLabel: t('tabs.history'),
          tabBarIcon: tabIcon('calendar'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarAccessibilityLabel: t('tabs.settings'),
          tabBarIcon: tabIcon('settings'),
        }}
      />
    </Tabs>
  );
}
