import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, Modal, ScrollView, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, NEWS_CATEGORIES } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { newsAPI } from '../services/api';

export default function NewsScreen() {
  const { isAdmin } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Create article state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('LOCAL');
  const [images, setImages] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadNews();
  }, [selectedCategory]);

  const loadNews = async () => {
    try {
      setLoading(true);
      const params = selectedCategory ? { category: selectedCategory } : {};
      const response = await newsAPI.getAll(params);
      setNews(response.data.news);
    } catch (error) {
      console.error('News error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5));
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      return Alert.alert('Required', 'Title and content are required.');
    }
    try {
      setCreating(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('category', category);
      images.forEach((uri, i) => {
        formData.append('images', {
          uri,
          name: `news_${i}.jpg`,
          type: 'image/jpeg',
        });
      });
      await newsAPI.create(formData);
      Alert.alert('Published!', 'Article published successfully.');
      setShowCreate(false);
      setTitle(''); setContent(''); setCategory('LOCAL'); setImages([]);
      loadNews();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to publish article.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Article', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await newsAPI.delete(id);
            setNews(prev => prev.filter(n => n.id !== id));
            setSelectedArticle(null);
          } catch (e) {
            Alert.alert('Error', 'Failed to delete article.');
          }
        },
      },
    ]);
  };

  const renderArticle = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setSelectedArticle(item)}>
      {item.images?.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.articleImage} resizeMode="cover" />
      )}
      <View style={styles.cardContent}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.category}</Text>
        </View>
        <Text style={styles.articleTitle}>{item.title}</Text>
        <Text style={styles.articleContent} numberOfLines={3}>{item.content}</Text>
        <View style={styles.articleFooter}>
          <Text style={styles.reporterName}>✍️ {item.user?.name || item.reporter?.name || 'Admin'}</Text>
          <Text style={styles.articleDate}>
            {new Date(item.createdAt).toLocaleDateString('en-PK', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Articles</Text>
        <TouchableOpacity style={styles.publishBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.publishBtnText}>+ Publish</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={[{ key: null, label: 'All' }, ...NEWS_CATEGORIES]}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key || 'all'}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catChip, selectedCategory === item.key && styles.catChipActive]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <Text style={[styles.catText, selectedCategory === item.key && styles.catTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={news}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadNews} colors={[COLORS.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📰</Text>
              <Text style={styles.emptyText}>No news articles yet</Text>
            </View>
          )
        }
      />

      {/* Article Detail Modal */}
      <Modal visible={!!selectedArticle} animationType="slide" onRequestClose={() => setSelectedArticle(null)}>
        {selectedArticle && (
          <View style={styles.container}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedArticle(null)}>
                <Text style={styles.backBtn}>{'<'} Back</Text>
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity onPress={() => handleDelete(selectedArticle.id)}>
                  <Text style={styles.deleteBtn}>🗑 Delete</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {selectedArticle.images?.length > 0 && (
                <Image source={{ uri: selectedArticle.images[0] }} style={styles.detailImage} resizeMode="cover" />
              )}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{selectedArticle.category}</Text>
              </View>
              <Text style={[styles.articleTitle, { fontSize: 22 }]}>{selectedArticle.title}</Text>
              <Text style={styles.reporterName}>✍️ {selectedArticle.user?.name || selectedArticle.reporter?.name || 'Admin'}</Text>
              <Text style={styles.articleDate}>
                {new Date(selectedArticle.createdAt).toLocaleDateString('en-PK', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              <Text style={[styles.articleContent, { marginTop: 16, lineHeight: 24 }]}>{selectedArticle.content}</Text>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Create Article Modal */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.backBtn}>{'<'} Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Publish Article</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Article headline..."
              placeholderTextColor={COLORS.textLight}
            />
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {NEWS_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, category === c.key && styles.catChipActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
              value={content}
              onChangeText={setContent}
              placeholder="Write article content..."
              placeholderTextColor={COLORS.textLight}
              multiline
            />
            <Text style={styles.label}>Images (optional)</Text>
            <TouchableOpacity style={styles.imgPicker} onPress={pickImages}>
              <Text style={styles.imgPickerText}>📷 Pick Images ({images.length}/5)</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <ScrollView horizontal style={{ marginBottom: 16 }}>
                {images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.previewImg} />
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Publish Article</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  publishBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  publishBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  categoryList: { paddingHorizontal: 12, paddingVertical: 12 },
  catChip: {
    paddingHorizontal: 16,
    height: 36,
    justifyContent: 'center',
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  catTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  articleImage: { width: '100%', height: 180 },
  detailImage: { width: '100%', height: 220, borderRadius: 14, marginBottom: 14 },
  cardContent: { padding: 16 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  categoryBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  articleTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6, lineHeight: 24 },
  articleContent: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
  articleFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  reporterName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  articleDate: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  backBtn: { fontSize: 16, color: COLORS.white, fontWeight: '600' },
  deleteBtn: { fontSize: 14, color: '#FF6B6B', fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  imgPicker: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  imgPickerText: { fontSize: 14, color: COLORS.textSecondary },
  previewImg: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
