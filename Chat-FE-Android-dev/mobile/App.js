import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/state/AuthContext';
import { RealtimeProvider } from './src/state/RealtimeContext';
import { Colors } from './src/theme';

import { OfflineBanner } from './src/components/OfflineBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={Colors.midnight} />
        <AuthProvider>
          <RealtimeProvider>
            <OfflineBanner />
            <RootNavigator />
          </RealtimeProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.midnight,
  },
});
