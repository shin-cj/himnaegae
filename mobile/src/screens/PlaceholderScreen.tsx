import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>힘내개</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 80 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.dark, fontSize: 28, fontWeight: '900', marginTop: 10 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12 },
});
