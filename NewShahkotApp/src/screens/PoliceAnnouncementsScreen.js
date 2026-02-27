import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, RefreshControl, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../config/constants';
import { policeAPI } from '../services/api';

const CATEGORIES = [
  { key: null, label: 'All', icon: '📋' },
  { key: 'GENERAL', label: 'General', icon: '📢' },
  { key: 'SAFETY', label: 'Safety', icon: '🛡️' },
  { key: 'MISSING_PERSON', label: 'Missing', icon: '🔍' },
  { key: 'WANTED', label: 'Wanted', icon: '🚨' },
  { key: 'TRAFFIC', label: 'Traffic', icon: '🚗' },
  { key: 'EMERGENCY', label: 'Emergency', icon: '🆘' },
];

export default function PoliceAnnouncementsScreen({ navigation }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadAnnouncements();
  }, [selectedCategory]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      
      const response = await policeAPI.getAnnouncements(params);
      setAnnouncements(response.data.announcements);
    } catch (error) {
      console.error('Police announcements error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const callNumber = (number) => {
    Linking.openURL(`tel:${number}`).catch(() => 
      Alert.alert('Error', 'Unable to make call')
    );
  };

  const renderAnnouncement = ({ item }) => (
    <View style={[styles.card, item.isUrgent && styles.urgentCard]}>
      {item.isUrgent && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>🚨 URGENT</Text>
        </View>
      )}
      
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {CATEGORIES.find(c => c.key === item.category)?.icon} {item.category}
        </Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content}>{item.content}</Text>

      {item.images?.length > 0 && (
        <View style={styles.imageContainer}>
          {item.images.slice(0, 2).map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={styles.image} resizeMode="cover" />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString('en-PK', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
        
        {item.contactNumber && (
          <TouchableOpacity style={styles.callButton} onPress={() => callNumber(item.contactNumber)}>
            <Text style={styles.callButtonText}>📞 {item.contactNumber}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Police Announcements</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Emergency Contact */}
      <TouchableOpacity style={styles.emergencyBanner} onPress={() => callNumber('15')}>
        <Text style={styles.emergencyIcon}>🚔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencyTitle}>Police Emergency</Text>
          <Text style={styles.emergencyNumber}>Call 15</Text>
        </View>
        <Text style={styles.emergencyArrow}>📞</Text>
      </TouchableOpacity>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.key || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item.key && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === item.key && styles.categoryChipTextActive]}>
              {item.icon} {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Announcements List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderAnnouncement}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnnouncements(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚔</Text>
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    margin: 12,
    padding: 16,
    borderRadius: 12,
  },
  emergencyIcon: { fontSize: 28, marginRight: 12 },
  emergencyTitle: { fontSize: 14, color: COLORS.white, opacity: 0.9 },
  emergencyNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  emergencyArrow: { fontSize: 24 },
  categoryList: { paddingHorizontal: 12, paddingBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  categoryChipText: { fontSize: 13, color: COLORS.text },
  categoryChipTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A5F',
  },
  urgentCard: {
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  urgentBadge: {
    backgroundColor: '#DC2626',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  urgentText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  categoryBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: { fontSize: 12, color: COLORS.textSecondary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  content: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  imageContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  image: { flex: 1, height: 120, borderRadius: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: COLORS.textLight },
  callButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
