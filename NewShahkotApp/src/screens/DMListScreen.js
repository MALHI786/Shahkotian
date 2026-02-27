import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { dmAPI } from '../services/api';

export default function DMListScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 6000);
    return () => clearInterval(interval);
  }, []);

  const loadChats = async () => {
    try {
      const res = await dmAPI.getChats();
      setChats(res.data.chats || []);
    } catch (err) {
      console.log('DM list error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, []);

  const getOtherUser = (chat) => {
    if (chat.user1?.id === user?.id) return chat.user2;
    return chat.user1;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };

  const renderChat = ({ item }) => {
    const other = getOtherUser(item);
    const lastMsg = item.messages?.[0];
    const lastText = lastMsg?.text || (lastMsg?.images?.length ? '📷 Image' : 'No messages yet');
    const lastTime = lastMsg?.createdAt || item.updatedAt;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('DMChat', {
          chatId: item.id,
          otherUser: other,
          source: item.source,
        })}
        activeOpacity={0.7}
      >
        {other?.photoUrl ? (
          <Image source={{ uri: other.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{other?.name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={styles.chatBody}>
          <View style={styles.chatTop}>
            <Text style={styles.chatName} numberOfLines={1}>{other?.name || 'User'}</Text>
            <Text style={styles.chatTime}>{formatTime(lastTime)}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={styles.chatPreview} numberOfLines={1}>{lastText}</Text>
            {item.source === 'RISHTA' && (
              <View style={styles.rishtaBadge}>
                <Text style={styles.rishtaBadgeText}>💍</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            <Text style={styles.headerBack}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          <Text style={styles.headerBack}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChat}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>Your private conversations will appear here</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerBack: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  chatItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 14 },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  chatBody: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  chatTime: { fontSize: 11, color: COLORS.textLight },
  chatBottom: { flexDirection: 'row', alignItems: 'center' },
  chatPreview: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  rishtaBadge: { marginLeft: 6 },
  rishtaBadgeText: { fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
});
