import { StyleSheet, Platform } from 'react-native';
import { Colors } from './colors';

const baseFont = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'sans-serif',
});

export const Typography = StyleSheet.create({
  h1: {
    fontFamily: baseFont,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: baseFont,
    fontSize: 22,
    fontWeight: '600',
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: baseFont,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ink,
  },
  body: {
    fontFamily: baseFont,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.ink,
    lineHeight: 22,
  },
  bodyMuted: {
    fontFamily: baseFont,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.slate,
    lineHeight: 20,
  },
  caption: {
    fontFamily: baseFont,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.slate,
  },
  button: {
    fontFamily: baseFont,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
