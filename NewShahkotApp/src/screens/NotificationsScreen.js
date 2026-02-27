import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../config/constants';
import { notificationsAPI } from '../services/api';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.log('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {}
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {}
  };

  const getIcon = (type) => {
    const map = {
      RISHTA_APPROVED: '✅',
      RISHTA_REJECTED: '❌',
      NEWS_PUBLISHED: '📰',
      TOURNAMENT_UPDATE: '🏆',
      GENERAL: '🔔',
    };
    return map[type] || '🔔';
  };

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.unread]}
      onPress={() => markAsRead(item.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{getIcon(item.type)}</Text>
      <View style={styles.content}>
        <Text style={[styles.title, !item.read && styles.unreadText]}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications{notifications.filter(n => !n.read).length > 0 ? ` (${notifications.filter(n => !n.read).length})` : ''}
        </Text>
        {notifications.some(n => !n.read) && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔕</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
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
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  markAll: { color: COLORS.white, fontSize: 13, textDecorationLine: 'underline' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  unread: { backgroundColor: COLORS.primary + '10', borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  icon: { fontSize: 24, marginRight: 12 },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  unreadText: { fontWeight: '800' },
  message: { fontSize: 13, color: COLORS.textLight, marginTop: 3 },
  time: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { fontSize: 16, color: COLORS.textLight },
});
