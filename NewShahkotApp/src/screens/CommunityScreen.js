import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { COLORS } from '../config/constants';

const COMMUNITY_TABS = [
  { key: 'rishta', label: 'Rishta', icon: '💑', desc: 'Find your match' },
  { key: 'openchat', label: 'Open Chat', icon: '💬', desc: 'Discord-like chat' },
  { key: 'dm', label: 'Messages', icon: '✉️', desc: 'Private messages' },
  { key: 'ai', label: 'AI Bot', icon: '🤖', desc: 'Ask anything' },
];

export default function CommunityScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSub}>Connect with Shahkot</Text>
      </View>

      {/* Feature Cards */}
      <ScrollView contentContainerStyle={styles.content}>
        {COMMUNITY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.featureCard}
            onPress={() => {
              if (tab.key === 'rishta') {
                navigation.navigate('Rishta');
              } else if (tab.key === 'openchat') {
                navigation.navigate('OpenChat');
              } else if (tab.key === 'dm') {
                navigation.navigate('DMList');
              } else if (tab.key === 'ai') {
                navigation.navigate('AIChatbot');
              }
            }}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>{tab.icon}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{tab.label}</Text>
              <Text style={styles.cardDesc}>{tab.desc}</Text>
            </View>
            <Text style={styles.cardArrow}></Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  content: {
    padding: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIconText: { fontSize: 26 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary },
  cardArrow: { fontSize: 20, color: COLORS.textLight },
});
