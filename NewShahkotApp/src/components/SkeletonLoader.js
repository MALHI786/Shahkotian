import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS } from '../config/constants';

const { width } = Dimensions.get('window');

/**
 * SkeletonLoader — Animated placeholder while content is loading
 * @param {string} type - 'card' | 'list' | 'profile' | 'feed'
 * @param {number} count - Number of skeleton items to show (default: 3)
 */
export default function SkeletonLoader({ type = 'card', count = 3 }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBlock = ({ style }) => (
    <Animated.View style={[styles.block, style, { opacity }]} />
  );

  const renderCard = () => (
    <View style={styles.card}>
      <SkeletonBlock style={{ width: '100%', height: 120, borderRadius: 12 }} />
      <SkeletonBlock style={{ width: '70%', height: 16, marginTop: 12, borderRadius: 8 }} />
      <SkeletonBlock style={{ width: '40%', height: 14, marginTop: 8, borderRadius: 8 }} />
    </View>
  );

  const renderList = () => (
    <View style={styles.listItem}>
      <SkeletonBlock style={{ width: 50, height: 50, borderRadius: 25 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonBlock style={{ width: '60%', height: 16, borderRadius: 8 }} />
        <SkeletonBlock style={{ width: '90%', height: 12, marginTop: 8, borderRadius: 6 }} />
        <SkeletonBlock style={{ width: '40%', height: 12, marginTop: 6, borderRadius: 6 }} />
      </View>
    </View>
  );

  const renderProfile = () => (
    <View style={styles.profileItem}>
      <SkeletonBlock style={{ width: 70, height: 70, borderRadius: 35, alignSelf: 'center' }} />
      <SkeletonBlock style={{ width: '50%', height: 18, marginTop: 12, borderRadius: 8, alignSelf: 'center' }} />
      <SkeletonBlock style={{ width: '30%', height: 14, marginTop: 8, borderRadius: 6, alignSelf: 'center' }} />
    </View>
  );

  const renderFeed = () => (
    <View style={styles.feedItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <SkeletonBlock style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <SkeletonBlock style={{ width: '50%', height: 14, borderRadius: 6 }} />
          <SkeletonBlock style={{ width: '30%', height: 10, marginTop: 6, borderRadius: 4 }} />
        </View>
      </View>
      <SkeletonBlock style={{ width: '100%', height: 14, borderRadius: 6 }} />
      <SkeletonBlock style={{ width: '80%', height: 14, marginTop: 6, borderRadius: 6 }} />
      <SkeletonBlock style={{ width: '100%', height: 180, marginTop: 12, borderRadius: 12 }} />
    </View>
  );

  const items = Array.from({ length: count });
  const renderer = type === 'list' ? renderList : type === 'profile' ? renderProfile : type === 'feed' ? renderFeed : renderCard;

  return (
    <View style={styles.container}>
      {items.map((_, index) => (
        <View key={index}>{renderer()}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  block: {
    backgroundColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  profileItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    elevation: 2,
  },
  feedItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
});
