import React from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { COLORS } from '../config/constants';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🐅</Text>
        </View>
        <Text style={styles.title}>Shahkot Tiger</Text>
        <Text style={styles.subtitle}>شاہکوٹ ٹائیگر</Text>
        <Text style={styles.taglineSmall}>Your City, Your Pride</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.tagline}>Connecting Shahkot Together</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  icon: {
    fontSize: 70,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 8,
  },
  taglineSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  bottom: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
