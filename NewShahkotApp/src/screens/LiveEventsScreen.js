import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, RefreshControl, Linking, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { liveEventsAPI } from '../services/api';

const EVENT_CATEGORIES = [
  { key: null, label: 'All', icon: '📋' },
  { key: 'SPORTS', label: 'Sports', icon: '🏏' },
  { key: 'RELIGIOUS', label: 'Religious', icon: '🕌' },
  { key: 'CULTURAL', label: 'Cultural', icon: '🎭' },
  { key: 'POLITICAL', label: 'Political', icon: '🏛️' },
  { key: 'GENERAL', label: 'General', icon: '📢' },
];

export default function LiveEventsScreen({ navigation }) {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create event state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [venue, setVenue] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [selectedCategory]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      const response = await liveEventsAPI.getAll(params);
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Live events error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openStream = (url) => {
    if (!url) {
      Alert.alert('No Stream', 'Stream link is not available yet.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open stream link.'));
  };

  const createEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter event title.');
      return;
    }
    setCreating(true);
    try {
      await liveEventsAPI.create({
        title: title.trim(),
        description: description.trim() || null,
        streamUrl: streamUrl.trim() || null,
        videoUrl: videoUrl.trim() || null,
        venue: venue.trim() || null,
        category,
        isLive: false,
      });
      setShowCreate(false);
      setTitle(''); setDescription(''); setStreamUrl(''); setVideoUrl(''); setVenue('');
      loadEvents();
      Alert.alert('Success', 'Live event created!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create event.');
    } finally {
      setCreating(false);
    }
  };

  const toggleLive = async (eventId) => {
    try {
      await liveEventsAPI.toggleLive(eventId);
      loadEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle live status.');
    }
  };

  const deleteEvent = async (eventId) => {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await liveEventsAPI.delete(eventId);
            loadEvents();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete event.');
          }
        },
      },
    ]);
  };

  const getCatInfo = (key) => EVENT_CATEGORIES.find(c => c.key === key) || { icon: '📢', label: key };

  const renderEvent = ({ item }) => {
    const catInfo = getCatInfo(item.category);
    return (
      <View style={[styles.eventCard, item.isLive && styles.liveCard]}>
        {item.isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
        )}

        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailIcon}>{item.isLive ? '🔴' : '🎥'}</Text>
          </View>
        )}

        <View style={styles.eventInfo}>
          <View style={styles.eventCatTag}>
            <Text style={styles.eventCatText}>{catInfo.icon} {catInfo.label}</Text>
          </View>
          <Text style={styles.eventTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
          )}
          {item.venue && (
            <Text style={styles.eventVenue}>📍 {item.venue}</Text>
          )}
          {item.scheduledAt && !item.isLive && (
            <Text style={styles.eventSchedule}>
              🕐 {new Date(item.scheduledAt).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          )}

          <View style={styles.eventActions}>
            {item.streamUrl && (
              <TouchableOpacity
                style={[styles.watchBtn, item.isLive && styles.watchBtnLive]}
                onPress={() => openStream(item.streamUrl)}
              >
                <Text style={styles.watchBtnText}>
                  {item.isLive ? '🔴 Watch Live' : '▶️ Watch Stream'}
                </Text>
              </TouchableOpacity>
            )}

            {item.videoUrl && (
              <TouchableOpacity
                style={styles.watchBtn}
                onPress={() => openStream(item.videoUrl)}
              >
                <Text style={styles.watchBtnText}>🎬 Watch Video</Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.toggleBtn, item.isLive && styles.toggleBtnEnd]}
                  onPress={() => toggleLive(item.id)}
                >
                  <Text style={styles.toggleBtnText}>
                    {item.isLive ? '⏹ End' : '▶️ Go Live'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteEvent(item.id)}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Events</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={EVENT_CATEGORIES}
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

      {/* Events List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEvents(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎥</Text>
              <Text style={styles.emptyTitle}>No Live Events</Text>
              <Text style={styles.emptySubtext}>Events will appear here when scheduled</Text>
            </View>
          }
        />
      )}

      {/* Create Event Modal (Admin) */}
      <Modal visible={showCreate} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Live Event</Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={styles.modalBody}>
            <TextInput style={styles.input} placeholder="Event Title *" value={title}
              onChangeText={setTitle} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Description"
              value={description} onChangeText={setDescription} multiline placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Stream URL (YouTube/Facebook Live)"
              value={streamUrl} onChangeText={setStreamUrl} placeholderTextColor={COLORS.textLight}
              autoCapitalize="none" keyboardType="url" />
            <TextInput style={styles.input} placeholder="Video URL (saved video link)"
              value={videoUrl} onChangeText={setVideoUrl} placeholderTextColor={COLORS.textLight}
              autoCapitalize="none" keyboardType="url" />
            <TextInput style={styles.input} placeholder="Venue / Location"
              value={venue} onChangeText={setVenue} placeholderTextColor={COLORS.textLight} />

            <Text style={styles.fieldLabel}>Category</Text>
            <FlatList
              horizontal
              data={EVENT_CATEGORIES.filter(c => c.key)}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
                  onPress={() => setCategory(item.key)}
                >
                  <Text style={[styles.categoryChipText, category === item.key && styles.categoryChipTextActive]}>
                    {item.icon} {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.6 }]}
              onPress={createEvent}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Create Event</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#DC2626',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  addBtn: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  categoryList: { paddingHorizontal: 12, paddingVertical: 10 },
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
  categoryChipActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  categoryChipText: { fontSize: 13, color: COLORS.text },
  categoryChipTextActive: { color: COLORS.white },
  // Event Card
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  liveCard: {
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 6,
  },
  liveText: { color: COLORS.white, fontWeight: '800', fontSize: 11 },
  thumbnail: { width: '100%', height: 180 },
  thumbnailPlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: { fontSize: 56 },
  eventInfo: { padding: 14 },
  eventCatTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  eventCatText: { fontSize: 11, color: COLORS.textSecondary },
  eventTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  eventDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 6 },
  eventVenue: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  eventSchedule: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 8 },
  eventActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  watchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  watchBtnLive: { backgroundColor: '#DC2626' },
  watchBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  adminActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  toggleBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnEnd: { backgroundColor: '#DC2626' },
  toggleBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 12 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: COLORS.surface,
    elevation: 2,
  },
  modalClose: { fontSize: 24, color: COLORS.text, padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: 20 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 4 },
  submitBtn: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
