import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { roleColor } from '../lib/roles';
import { initialOf } from '../lib/time';
import { Colors, Radii } from '../theme';

export function Avatar({ name, role, isGroup = false, size = 40, style }) {
  const isGrp = isGroup || role === 'GROUP';
  const bg = isGrp ? Colors.midnight : roleColor(role);
  const fontSize = Math.round(size * (isGrp ? 0.44 : 0.42));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Radii.full,
          backgroundColor: bg,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name || (isGrp ? 'Group' : 'User')}`}
    >
      {isGrp ? (
        <Text style={[styles.text, { fontSize }]}>👥</Text>
      ) : (
        <Text style={[styles.text, { fontSize }]}>{initialOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

