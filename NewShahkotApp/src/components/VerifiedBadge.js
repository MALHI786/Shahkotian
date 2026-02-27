import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

/**
 * VerifiedBadge — Reusable verified checkmark component
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {boolean} showLabel - show "Verified" text next to icon
 */
export default function VerifiedBadge({ size = 'small', showLabel = false }) {
  const iconSize = size === 'large' ? 18 : size === 'medium' ? 14 : 12;
  const containerSize = size === 'large' ? 24 : size === 'medium' ? 20 : 16;

  return (
    <View style={[styles.container, showLabel && styles.withLabel]}>
      <View style={[styles.badge, { width: containerSize, height: containerSize, borderRadius: containerSize / 2 }]}>
        <Ionicons name="checkmark" size={iconSize} color={COLORS.white} />
      </View>
      {showLabel && <Text style={[styles.label, size === 'large' && { fontSize: 14 }]}>Verified</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  withLabel: {
    gap: 4,
  },
  badge: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
