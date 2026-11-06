import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hexToRgba, roleColor, roleLabel } from '../lib/roles';
import { Radii } from '../theme';

export function RoleBadge({ role, style }) {
  const color = roleColor(role);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: hexToRgba(color, 0.15),
          borderColor: hexToRgba(color, 0.35),
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color }]}>{roleLabel(role)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
