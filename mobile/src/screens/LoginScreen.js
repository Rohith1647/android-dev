import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { request } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, expiredNotice, clearExpiredNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      clearExpiredNotice?.();

      const response = await request('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password },
      });

      await signIn({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        mustChange: response.mustChangePassword,
      });
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, Spacing.xl),
            paddingBottom: Math.max(insets.bottom, Spacing.xl),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/setu-vertical.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>SETU</Text>
          <Text style={styles.subtitle}>Secure Enterprise Real-Time Messaging</Text>
        </View>

        {/* Notices */}
        {Boolean(expiredNotice) && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerText}>{expiredNotice}</Text>
          </View>
        )}

        {Boolean(errorMessage) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="name@organization.com"
              placeholderTextColor={Colors.slate}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={Colors.slate}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeToggle}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.midnight} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Accounts are managed by your administrator or HR.
        </Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoImage: {
    width: 120,
    height: 72,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.midnight,
  },
  subtitle: {
    ...Typography.bodyMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#FFF4E5',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    padding: Spacing.md,
    borderRadius: Radii.sm,
    marginBottom: Spacing.lg,
  },
  warningBannerText: {
    ...Typography.caption,
    color: '#8A5300',
  },
  errorBanner: {
    backgroundColor: '#FDEDED',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    padding: Spacing.md,
    borderRadius: Radii.sm,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    ...Typography.caption,
    color: Colors.error,
  },
  form: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.midnight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.midnight,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.canvas,
    color: Colors.ink,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.canvas,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    color: Colors.ink,
    fontSize: 16,
  },
  eyeToggle: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.slate,
  },
  loginButton: {
    height: 48,
    backgroundColor: Colors.ember,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    ...Typography.button,
    color: Colors.midnight,
    fontWeight: '700',
  },
  footerNote: {
    ...Typography.caption,
    color: Colors.slate,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
