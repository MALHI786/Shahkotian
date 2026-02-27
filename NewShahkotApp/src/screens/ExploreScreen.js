import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

const CATEGORIES = [
  {
    title: 'Community',
    icon: 'people',
    color: '#6366F1',
    items: [
      { key: 'Feed', label: 'Posts / Feed', icon: 'chatbubble-ellipses', desc: 'Community Posts', color: '#6366F1' },
      { key: 'OpenChat', label: 'Open Chat', icon: 'chatbubbles', desc: 'Public Chat Room', color: '#14B8A6' },
      { key: 'Rishta', label: 'Rishta', icon: 'heart-circle', desc: 'Matrimonial', color: '#EC4899' },
      { key: 'DMList', label: 'DM Chat', icon: 'mail', desc: 'Private Messages', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Services',
    icon: 'briefcase',
    color: '#2563EB',
    items: [
      { key: 'Jobs', label: 'Jobs', icon: 'briefcase', desc: 'Find & Post Jobs', color: '#2563EB' },
      { key: 'Market', label: 'Buy & Sell', icon: 'cart', desc: 'Marketplace', color: '#FF6584' },
      { key: 'Bazar', label: 'Bazar Finder', icon: 'storefront', desc: 'Find Shops', color: '#3B82F6' },
      { key: 'GovtOffices', label: 'Govt Offices', icon: 'business', desc: 'Directory & Helplines', color: '#F59E0B' },
      { key: 'Doctors', label: 'Doctors', icon: 'medkit', desc: 'Find Healthcare', color: '#E11D48' },
      { key: 'RestaurantDeals', label: 'Restaurants', icon: 'restaurant', desc: 'Deals & Offers', color: '#F97316' },
    ],
  },
  {
    title: 'Information',
    icon: 'information-circle',
    color: '#8B5CF6',
    items: [
      { key: 'News & Articles', label: 'News', icon: 'newspaper', desc: 'Local Updates', color: '#8B5CF6' },
      { key: 'Weather', label: 'Weather', icon: 'partly-sunny', desc: 'Shahkot Forecast', color: '#0EA5E9' },

      { key: 'Helpline', label: 'Helplines', icon: 'call', desc: 'Emergency Numbers', color: '#EF4444' },
    ],
  },
  {
    title: 'Activities',
    icon: 'trophy',
    color: '#10B981',
    items: [
      { key: 'Tournaments', label: 'Tournaments', icon: 'trophy', desc: 'Sports Events', color: '#10B981' },
      { key: 'BloodDonation', label: 'Blood Bank', icon: 'water', desc: 'Donate & Find', color: '#B91C1C' },
      { key: 'AIChatbot', label: 'AI Chatbot', icon: 'sparkles', desc: 'Ask Anything', color: '#6366F1' },
    ],
  },
];

export default function ExploreScreen({ navigation }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)),
    })).filter(cat => cat.items.length > 0);
  }, [search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Shahkot</Text>
        <Text style={styles.headerSub}>Discover all city services & features</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Quick Actions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {[
            { key: 'Feed', label: 'New Post', icon: 'create', color: '#6366F1' },
            { key: 'Jobs', label: 'Post Job', icon: 'briefcase', color: '#2563EB' },
            { key: 'Market', label: 'Sell Item', icon: 'add-circle', color: '#FF6584' },
            { key: 'AIChatbot', label: 'Ask AI', icon: 'sparkles', color: '#8B5CF6' },
          ].map(a => (
            <TouchableOpacity key={a.key} style={styles.quickAction} onPress={() => navigation.navigate(a.key)}>
              <View style={[styles.quickActionIcon, { backgroundColor: a.color + '12' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={styles.quickActionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Categories */}
        {filtered.map((cat) => (
          <View key={cat.title} style={styles.catSection}>
            <View style={styles.catHeader}>
              <View style={[styles.catIconWrap, { backgroundColor: cat.color + '12' }]}>
                <Ionicons name={cat.icon} size={16} color={cat.color} />
              </View>
              <Text style={styles.catTitle}>{cat.title}</Text>
            </View>
            <View style={styles.catGrid}>
              {cat.items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.card}
                  onPress={() => navigation.navigate(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cardIcon, { backgroundColor: item.color + '10' }]}>
                    <Ionicons name={item.icon} size={26} color={item.color} />
                  </View>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {search.trim() && filtered.length === 0 && (
          <View style={styles.emptySearch}>
            <Ionicons name="search-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No services found for "{search}"</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },

  // Quick Actions
  quickRow: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6, gap: 12 },
  quickAction: { alignItems: 'center', width: 72 },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },

  // Categories
  catSection: { marginTop: 20, paddingHorizontal: 16 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardDesc: { fontSize: 11, color: COLORS.textLight },

  // Empty
  emptySearch: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 12 },
});
