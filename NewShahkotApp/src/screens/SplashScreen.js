import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Image } from 'react-native';
import { COLORS } from '../config/constants';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Pulsing dots
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animateDots();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.title}>APNA SHAHKOT</Text>
        <Text style={styles.taglineSmall}>Your City, Your Community</Text>
      </Animated.View>
      <View style={styles.bottom}>
        <View style={styles.loadingDots}>
          <Animated.View style={[styles.dot, { opacity: dotAnim1 }]} />
          <Animated.View style={[styles.dot, { opacity: dotAnim2 }]} />
          <Animated.View style={[styles.dot, { opacity: dotAnim3 }]} />
        </View>
        <Text style={styles.tagline}>Connecting Shahkot Together 🇵🇰</Text>
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
    paddingHorizontal: 30,
  },
  logoImage: {
    width: 160,
    height: 160,
    marginBottom: 24,
    borderRadius: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 8,
    letterSpacing: 3,
  },
  taglineSmall: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
