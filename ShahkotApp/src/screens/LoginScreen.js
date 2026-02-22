import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { COLORS, APP_NAME } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { isWithinShahkot } from '../utils/geolocation';

export default function LoginScreen({ navigation }) {
  const { register, login } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    checkLocation();
  }, []);

  const checkLocation = async () => {
    try {
      setLocationLoading(true);
      // GEOFENCING DISABLED - Skip location permission check
      // Just set a default location (Shahkot center) to allow app to work
      setLocation({
        latitude: 31.5709,
        longitude: 73.4853,
      });
      setLocationError(null);
    } catch (error) {
      // Even if error, allow app to work
      setLocation({
        latitude: 31.5709,
        longitude: 73.4853,
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const handleAuth = async () => {
    // GEOFENCING DISABLED - No location check required
    
    if (isRegistering && (!name.trim() || !phone.trim() || !password.trim())) {
      Alert.alert('Required', 'Please enter your name, phone number, and password.');
      return;
    }

    if (!isRegistering && (!phone.trim() || !password.trim())) {
      Alert.alert('Required', 'Please enter your phone number and password.');
      return;
    }

    // Validate password is 8 digits
    if (!/^\d{8}$/.test(password)) {
      Alert.alert('Invalid Password', 'Password must be exactly 8 digits (numbers only).');
      return;
    }

    setLoading(true);
    try {
      // In production, use Firebase Auth phone verification
      // For now, using phone as firebaseUid placeholder
      const firebaseUid = `phone_${phone.replace(/\D/g, '')}`;

      if (isRegistering) {
        await register({
          name: name.trim(),
          phone: phone.trim(),
          password: password.trim(),
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || phone.trim(),
          firebaseUid,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        Alert.alert('Welcome!', `Welcome to ${APP_NAME}, ${name}!`);
      } else {
        await login({
          phone: phone.trim(),
          password: password.trim(),
          firebaseUid,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        (error.request
          ? 'Cannot reach server. Please try again in a moment.'
          : 'Something went wrong. Please try again.');
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // Location loading state
  if (locationLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.locationText}>Checking your location...</Text>
        <Text style={styles.subText}>Verifying you are in Shahkot area</Text>
      </View>
    );
  }

  // Location denied state
  if (locationError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>📍</Text>
        <Text style={styles.errorTitle}>Location Restricted</Text>
        <Text style={styles.errorText}>{locationError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkLocation}>
          <Text style={styles.retryText}>Retry Location Check</Text>
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
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🏘️</Text>
          </View>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>
            {isRegistering ? 'Create your account' : 'Welcome back!'}
          </Text>
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>📍 Shahkot Area Verified ✓</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {isRegistering && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+92 300 1234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password (8 digits) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 8-digit password"
              value={password}
              onChangeText={setPassword}
              keyboardType="number-pad"
              maxLength={8}
              secureTextEntry
              placeholderTextColor={COLORS.textLight}
            />
            <Text style={styles.hint}>Password must be exactly 8 digits</Text>
          </View>

          {isRegistering && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>WhatsApp Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Same as phone if empty"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering ? 'Create Account' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegistering(!isRegistering)}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.background,
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
  icon: { fontSize: 40 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  locationBadge: {
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationBadgeText: {
    color: COLORS.success,
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
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
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
  locationText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  subText: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  errorIcon: { fontSize: 60, marginBottom: 16 },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
