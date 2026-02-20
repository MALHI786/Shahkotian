import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { COLORS } from '../config/constants';

const SERVICES = [
  { key: 'GovtOffices', label: 'Govt Offices', icon: '🏛️', desc: 'Directory & Helplines', color: '#F59E0B' },
  { key: 'Bazar', label: 'Bazar Finder', icon: '🏪', desc: 'Find Shops & Products', color: '#3B82F6' },
  { key: 'Tournaments', label: 'Tournaments', icon: '🏆', desc: 'Sports Events', color: '#10B981' },
  { key: 'News & Articles', label: 'News & Articles', icon: '📰', desc: 'Local Updates', color: '#8B5CF6' },
  { key: 'BloodDonation', label: 'Blood Bank', icon: '🩸', desc: 'Donate & Find Donors', color: '#B91C1C' },
  { key: 'Weather', label: 'Weather', icon: '🌤️', desc: 'Shahkot Forecast', color: '#0EA5E9' },
  { key: 'AIChatbot', label: 'AI Chatbot', icon: '🤖', desc: 'Ask anything', color: '#6366F1' },
  { key: 'Helpline', label: 'Helplines', icon: '📞', desc: 'Emergency Numbers', color: '#EF4444' },
  { key: 'OpenChat', label: 'Open Chat', icon: '💬', desc: 'Community Chat Room', color: '#14B8A6' },
];

export default function ExploreScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Shahkot</Text>
        <Text style={styles.headerSub}>City services & utilities</Text>
      </View>

      {/* Services Grid */}
      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.key}
            style={[styles.card, { borderLeftColor: service.color }]}
            onPress={() => navigation.navigate(service.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: service.color + '15' }]}>
              <Text style={styles.cardIcon}>{service.icon}</Text>
            </View>
            <Text style={styles.cardLabel}>{service.label}</Text>
            <Text style={styles.cardDesc}>{service.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIcon: { fontSize: 26 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardDesc: { fontSize: 12, color: COLORS.textLight },
});
