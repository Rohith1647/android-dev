import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRealtime } from '../state/RealtimeContext';
import { Colors } from '../theme';

/**
 * Persistent real-time connectivity banner across the application.
 * Informs the user when the mobile device has dropped connection or is reconnecting.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { status, isOnline } = useRealtime();

  if (isOnline && status === 'connected') {
    return null;
  }

  let text = 'Reconnecting to chat…';
  let backgroundColor = '#FEF3C7';
  let textColor = '#B45309';

  if (!isOnline) {
    text = '⚠️ No Internet Connection (Offline)';
    backgroundColor = '#FEE2E2';
    textColor = '#B91C1C';
  } else if (status === 'disconnected') {
    text = 'Disconnected from chat broker. Reconnecting…';
    backgroundColor = '#FEE2E2';
    textColor = '#B91C1C';
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor,
          paddingTop: Math.max(insets.top, 6),
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.bannerText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingBottom: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
