import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TABS: Array<{ name: string; title: string; icon: IoniconName; activeIcon: IoniconName }> = [
  { name: 'index', title: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'surveys', title: 'Surveys', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  { name: 'insights', title: 'Insights', icon: 'bulb-outline', activeIcon: 'bulb' },
  { name: 'reviews', title: 'Reviews', icon: 'star-outline', activeIcon: 'star' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', activeIcon: 'person' },
]

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4F46E5', tabBarInactiveTintColor: '#9ca3af', headerShown: false, tabBarStyle: { height: 84, paddingBottom: 24, borderTopColor: '#e5e7eb' } }}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{
          title: tab.title,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? tab.activeIcon : tab.icon} size={24} color={color} />,
        }} />
      ))}
    </Tabs>
  )
}
