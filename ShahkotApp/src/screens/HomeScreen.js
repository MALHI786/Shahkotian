import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  Image, ImageBackground, FlatList, ActivityIndicator, TextInput,
} from 'react-native';
import { COLORS, APP_NAME } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { postsAPI, listingsAPI, newsAPI, tournamentsAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [trendingListings, setTrendingListings] = useState([]);
  const [latestNews, setLatestNews] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      const [listingsRes, newsRes, tournamentsRes, postsRes] = await Promise.allSettled([
        listingsAPI.getAll({ limit: 4 }),
        newsAPI.getAll({ limit: 3 }),
        tournamentsAPI.getAll(),
        postsAPI.getFeed(1),
      ]);
      if (listingsRes.status === 'fulfilled') setTrendingListings(listingsRes.value.data.listings?.slice(0, 4) || []);
      if (newsRes.status === 'fulfilled') setLatestNews(newsRes.value.data.news?.slice(0, 3) || []);
      if (tournamentsRes.status === 'fulfilled') setUpcomingMatches(tournamentsRes.value.data.tournaments?.slice(0, 3) || []);
      if (postsRes.status === 'fulfilled') setRecentPosts(postsRes.value.data.posts?.slice(0, 3) || []);
    } catch (error) {
      console.error('Home data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_ACCESS = [
    { key: 'Market', label: 'Buy & Sell', icon: '🛒', color: '#FF6584' },
    { key: 'News & Articles', label: 'News', icon: '📰', color: '#8B5CF6' },
    { key: 'Tournaments', label: 'Sports', icon: '🏆', color: '#10B981' },
    { key: 'Bazar', label: 'Bazar', icon: '🏪', color: '#3B82F6' },
    { key: 'BloodDonation', label: 'Blood', icon: '🩸', color: '#B91C1C' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Tiger Header */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?auto=format&fit=crop&w=800&q=80' }}
          style={styles.header}
          imageStyle={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.appBrandLabel}>🐯 SHAHKOT TIGERS</Text>
                <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                <Text style={styles.userName}>{user?.name || 'User'}</Text>
              </View>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Text style={{ fontSize: 22 }}>🔔</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => navigation.navigate('Explore')}
              activeOpacity={0.8}
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>Search Shahkot...</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

      {/* Location Badge */}
      <View style={styles.locationBanner}>
        <Text style={styles.locationIcon}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Shahkot, Pakistan</Text>
          <Text style={styles.locationSub}>Connected with your community</Text>
        </View>
        <View style={styles.liveDot} />
      </View>

      {/* Quick Access Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAccessRow}>
        {QUICK_ACCESS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate(item.key)}
          >
            <View style={[styles.quickAccessIcon, { backgroundColor: item.color + '15' }]}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <Text style={styles.quickAccessLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Trending Listings */}
      {trendingListings.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Trending Listings</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Market')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {trendingListings.map((item) => (
              <TouchableOpacity key={item.id} style={styles.listingCard} onPress={() => navigation.navigate('Market')}>
                {item.images?.[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.listingImage} />
                ) : (
                  <View style={styles.listingImagePlaceholder}>
                    <Text style={{ fontSize: 28 }}>📦</Text>
                  </View>
                )}
                <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.listingPrice}>Rs. {Number(item.price || 0).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Latest News */}
      {latestNews.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📰 Latest News</Text>
            <TouchableOpacity onPress={() => navigation.navigate('News & Articles')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {latestNews.map((item) => (
            <TouchableOpacity key={item.id} style={styles.newsCard} onPress={() => navigation.navigate('News & Articles')}>
              <View style={styles.newsBadge}>
                <Text style={styles.newsBadgeText}>{item.category}</Text>
              </View>
              <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.newsDate}>
                {new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Upcoming Tournaments */}
      {upcomingMatches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏏 Upcoming Tournaments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tournaments')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {upcomingMatches.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.tournamentCard}
              onPress={() => navigation.navigate('TournamentDetail', { id: item.id })}
            >
              <Text style={styles.tournamentIcon}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tournamentName}>{item.name}</Text>
                <Text style={styles.tournamentVenue}>📍 {item.venue}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📢 Recent Posts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Community')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {recentPosts.map((item) => (
            <View key={item.id} style={styles.postPreviewCard}>
              <View style={styles.postPreviewHeader}>
                <View style={styles.postAvatar}>
                  <Text style={styles.postAvatarText}>{item.user?.name?.[0] || '?'}</Text>
                </View>
                <Text style={styles.postUserName}>{item.user?.name}</Text>
              </View>
              {item.text && <Text style={styles.postPreviewText} numberOfLines={2}>{item.text}</Text>}
              <View style={styles.postPreviewStats}>
                <Text style={styles.postStat}>❤️ {item.likesCount || 0}</Text>
                <Text style={styles.postStat}>💬 {item.commentsCount || 0}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{APP_NAME} v1.0</Text>
        <Text style={styles.footerSub}>Made for the people of Shahkot 🇵🇰</Text>
      </View>
    </ScrollView>

      {/* Floating AI Button */}
      <TouchableOpacity
        style={styles.aiFloatingBtn}
        onPress={() => navigation.navigate('AIChatbot')}
        activeOpacity={0.85}
      >
        <Text style={styles.aiFloatingIcon}>✨</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerOverlay: {
    backgroundColor: 'rgba(0,0,0,0.52)',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  appBrandLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.80)' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 2 },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchPlaceholder: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: -14,
    padding: 14,
    borderRadius: 14,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  locationIcon: { fontSize: 24, marginRight: 10 },
  locationTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  locationSub: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  quickAccessRow: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  quickAccessItem: { alignItems: 'center', marginRight: 18 },
  quickAccessIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickAccessLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  horizontalList: { paddingRight: 8 },
  listingCard: {
    width: 150,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginRight: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  listingImage: { width: '100%', height: 100 },
  listingImagePlaceholder: { width: '100%', height: 100, backgroundColor: COLORS.gray, justifyContent: 'center', alignItems: 'center' },
  listingTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, paddingHorizontal: 10, paddingTop: 8 },
  listingPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
  newsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
  },
  newsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  newsBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  newsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, lineHeight: 20 },
  newsDate: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
  },
  tournamentIcon: { fontSize: 28, marginRight: 12 },
  tournamentName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  tournamentVenue: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  postPreviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
  },
  postPreviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  postAvatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
  postUserName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  postPreviewText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  postPreviewStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  postStat: { fontSize: 12, color: COLORS.textLight },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 20,
  },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  footerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  aiFloatingBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  aiFloatingIcon: { fontSize: 26 },
});
