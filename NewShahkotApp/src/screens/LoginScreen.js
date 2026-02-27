import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import * as Location from 'expo-location';
import { COLORS, APP_NAME, GEOFENCE_RADIUS_KM } from '../config/constants';
import { isWithinShahkot } from '../utils/geolocation';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function LoginScreen({ navigation }) {
  const { register, login } = useAuth();

  // mode: 'LOGIN' | 'REGISTER' | 'OTP' | 'FORGOT' | 'RESET_OTP' | 'NEW_PASSWORD'
  const [mode, setMode] = useState('LOGIN');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  // Location state
  const [locationChecked, setLocationChecked] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // ── Check location on mount ────────────────────────────────────────────
  useEffect(() => {
    checkLocation();
  }, []);

  const checkLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationChecked(true);
        setLocationAllowed(false);
        setLocationLoading(false);
        Alert.alert(
          'Location Required',
          'This app is only available for Shahkot residents. Please enable location services to continue.',
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setUserCoords({ latitude, longitude });

      const result = isWithinShahkot(latitude, longitude);
      setLocationChecked(true);
      setLocationAllowed(result.isWithin);

      if (!result.isWithin) {
        Alert.alert(
          'Outside Shahkot',
          `You are ${result.distance} KM away from Shahkot. This app is only available within ${GEOFENCE_RADIUS_KM} KM of Shahkot city.`,
        );
      }
    } catch (error) {
      console.error('Location check error:', error);
      setLocationChecked(true);
      setLocationAllowed(false);
      Alert.alert('Location Error', 'Could not determine your location. Please enable GPS and try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setPhone(''); setOtp(''); setNewPassword('');
  };

  // ── Step 1 (Register): send OTP to email ──────────────────────────────
  const handleSendOtp = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Invalid Email', 'Please enter a valid email address.');
    }
    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    setOtpSending(true);
    try {
      await authAPI.sendOtp(email.trim());
      setMode('OTP');
      Alert.alert('OTP Sent ✅', `A 6-digit code has been sent to ${email.trim()}. Check your inbox (and spam folder).`);
    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const msg = isTimeout
        ? 'Server is starting up (takes ~30 sec on free tier). Please wait a moment and try again.'
        : error.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setOtpSending(false);
    }
  };

  // ── Step 2 (Register): verify OTP + create account ────────────────────
  const handleRegister = async () => {
    if (!locationAllowed) {
      return Alert.alert('Location Required', 'This app is only available within 50 KM of Shahkot. Please enable location and try again.', [
        { text: 'Retry', onPress: checkLocation },
      ]);
    }
    if (otp.trim().length !== 6) return Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        otp: otp.trim(),
        phone: phone.trim() || undefined,
        whatsapp: phone.trim() || undefined,
        latitude: userCoords?.latitude,
        longitude: userCoords?.longitude,
      });
      Alert.alert('Welcome! 🎉', `Your account has been created. Welcome to ${APP_NAME}!`);
    } catch (error) {
      const msg = error.response?.data?.error || 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Login: email + password ────────────────────────────────────────────
  const handleLogin = async () => {
    if (!locationAllowed) {
      return Alert.alert('Location Required', 'This app is only available within 50 KM of Shahkot. Please enable location and try again.', [
        { text: 'Retry', onPress: checkLocation },
      ]);
    }
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Required', 'Please enter your email and password.');
    }
    setLoading(true);
    try {
      await login({
        email: email.trim(),
        password: password.trim(),
        latitude: userCoords?.latitude,
        longitude: userCoords?.longitude,
      });
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        (error.request
          ? 'Cannot reach server. Please check your connection.'
          : 'Something went wrong. Please try again.');
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: send OTP ─────────────────────────────────────────
  const handleForgotSendOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Alert.alert('Invalid Email', 'Please enter your registered email.');
    }
    setOtpSending(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setMode('RESET_OTP');
      Alert.alert('OTP Sent ✅', `A code has been sent to ${email.trim()}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Reset Password: verify OTP + new password ─────────────────────────
  const handleResetPassword = async () => {
    if (otp.trim().length !== 6) return Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
    if (newPassword.length < 6) return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    setLoading(true);
    try {
      await authAPI.resetPassword({ email: email.trim(), otp: otp.trim(), newPassword });
      Alert.alert('Success ✅', 'Password reset! You can now login with your new password.');
      setOtp(''); setNewPassword('');
      setMode('LOGIN');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password screen ──────────────────────────────────────────
  if (mode === 'FORGOT') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconCircle}><Text style={styles.icon}>🔑</Text></View>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>Enter your registered email to receive a reset code</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput style={styles.input} placeholder="your@gmail.com" value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
            </View>
            <TouchableOpacity style={[styles.button, otpSending && styles.buttonDisabled]}
              onPress={handleForgotSendOtp} disabled={otpSending}>
              {otpSending ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton} onPress={() => { setMode('LOGIN'); }}>
              <Text style={[styles.switchText, { color: COLORS.textSecondary }]}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Reset OTP + New Password screen ────────────────────────────────────
  if (mode === 'RESET_OTP') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconCircle}><Text style={styles.icon}>🔐</Text></View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter the code sent to</Text>
            <Text style={[styles.subtitle, { color: COLORS.primary, fontWeight: '700', marginTop: 2 }]}>{email}</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>OTP Code *</Text>
              <TextInput style={[styles.input, styles.otpInput]} placeholder="000000" value={otp}
                onChangeText={setOtp} keyboardType="number-pad" maxLength={6}
                placeholderTextColor={COLORS.textLight} textAlign="center" />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password *</Text>
              <TextInput style={styles.input} placeholder="Min 6 characters" value={newPassword}
                onChangeText={setNewPassword} secureTextEntry placeholderTextColor={COLORS.textLight} />
            </View>
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Reset Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton}
              onPress={() => { setOtp(''); handleForgotSendOtp(); }} disabled={otpSending}>
              <Text style={styles.switchText}>{otpSending ? 'Resending...' : "Didn't receive it? Resend Code"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.switchButton, { marginTop: 4 }]} onPress={() => setMode('FORGOT')}>
              <Text style={[styles.switchText, { color: COLORS.textSecondary }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── OTP verification screen ────────────────────────────────────────────
  if (mode === 'OTP') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>📧</Text>
            </View>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
            <Text style={[styles.subtitle, { color: COLORS.primary, fontWeight: '700', marginTop: 2 }]}>
              {email}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>OTP Code *</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor={COLORS.textLight}
                textAlign="center"
              />
              <Text style={styles.hint}>Check your Gmail inbox (and spam folder)</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => { setOtp(''); handleSendOtp(); }}
              disabled={otpSending}
            >
              <Text style={styles.switchText}>
                {otpSending ? 'Resending...' : "Didn't receive it? Resend OTP"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.switchButton, { marginTop: 4 }]}
              onPress={() => { setOtp(''); setMode('REGISTER'); }}
            >
              <Text style={[styles.switchText, { color: COLORS.textSecondary }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Login / Register form ──────────────────────────────────────────────
  const isRegister = mode === 'REGISTER';

  // Show loading while checking location
  if (locationLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.subtitle, { marginTop: 16 }]}>Checking your location...</Text>
        <Text style={[styles.hint, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
          This app is only available within {GEOFENCE_RADIUS_KM} KM of Shahkot city
        </Text>
      </View>
    );
  }

  // Show blocked screen if outside geofence
  if (locationChecked && !locationAllowed) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>📍</Text>
        <Text style={[styles.title, { textAlign: 'center' }]}>Outside Shahkot</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8, marginBottom: 24 }]}>
          This app is exclusively for Shahkot residents and can only be used within {GEOFENCE_RADIUS_KM} KM of Shahkot city.
        </Text>
        <TouchableOpacity style={styles.button} onPress={checkLocation}>
          <Text style={styles.buttonText}>🔄 Check Location Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>
            {isRegister ? 'Create your account' : 'Welcome back!'}
          </Text>
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>📍 Shahkot Community App</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {isRegister && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="your@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder={isRegister ? 'Min 6 characters' : 'Enter your password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={COLORS.textLight}
            />
            {isRegister && (
              <Text style={styles.hint}>At least 6 characters</Text>
            )}
          </View>

          {isRegister && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone / WhatsApp (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+92 300 1234567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          )}

          {/* Primary button */}
          <TouchableOpacity
            style={[styles.button, (loading || otpSending) && styles.buttonDisabled]}
            onPress={isRegister ? handleSendOtp : handleLogin}
            disabled={loading || otpSending}
          >
            {loading || otpSending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isRegister ? 'Send OTP to Email' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          {isRegister && (
            <View style={styles.otpNote}>
              <Text style={styles.otpNoteText}>
                📧 An OTP will be sent to your Gmail to verify your email address.
              </Text>
            </View>
          )}

          {/* Forgot Password (login mode only) */}
          {!isRegister && (
            <TouchableOpacity
              style={[styles.switchButton, { marginTop: 8 }]}
              onPress={() => { setOtp(''); setNewPassword(''); setMode('FORGOT'); }}
            >
              <Text style={[styles.switchText, { color: COLORS.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Toggle login / register */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => { resetForm(); setMode(isRegister ? 'LOGIN' : 'REGISTER'); }}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.switchButton, { marginTop: 8 }]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={[styles.switchText, { color: COLORS.textSecondary, fontSize: 12 }]}>
              🔒 Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  locationBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  locationBadgeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  form: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  otpInput: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  otpNote: {
    backgroundColor: COLORS.info + '12',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  otpNoteText: {
    color: COLORS.info,
    fontSize: 13,
    lineHeight: 18,
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

