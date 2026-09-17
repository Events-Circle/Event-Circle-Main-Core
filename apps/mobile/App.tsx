import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@events-circle/design-system';
export default function App() {
  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.brand}>EVENTS CIRCLE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your growth, together.
      </Text>
      <Text style={styles.body}>
        The mobile foundation is ready for supplier screens. Presence, Leads and account flows will connect
        through the shared API client.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: tokens.colors.background },
  brand: { color: tokens.colors.ink, fontWeight: '700' },
  title: { fontSize: 36, fontWeight: '700', color: tokens.colors.ink, marginVertical: 24 },
  body: { fontSize: 18, lineHeight: 28, color: tokens.colors.ink },
});
