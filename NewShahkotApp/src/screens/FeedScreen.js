import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  StyleSheet, RefreshControl, Alert, ActivityIndicator, Modal, Share,
  KeyboardAvoidingView, Platform, Dimensions, ScrollView, Linking, Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function FeedScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Scroll animation states
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHeight = useRef(new Animated.Value(1)).current;

  // Create post state
  const [showCreate, setShowCreate] = useState(false);
  const [postText, setPostText] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [postVideos, setPostVideos] = useState([]);
  const [creating, setCreating] = useState(false);

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async (pageNum = 1, refresh = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      const response = await postsAPI.getFeed(pageNum);
      const newPosts = response.data.posts;

      if (refresh || pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(pageNum < response.data.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Load posts error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts(1, true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      loadPosts(page + 1);
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const scrollingDown = currentScrollY > lastScrollY.current && currentScrollY > 50;
        const scrollingUp = currentScrollY < lastScrollY.current;

        if (scrollingDown && headerVisible) {
          Animated.timing(headerHeight, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
          setHeaderVisible(false);
        } else if (scrollingUp && !headerVisible) {
          Animated.timing(headerHeight, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }).start();
          setHeaderVisible(true);
        }

        lastScrollY.current = currentScrollY;
      },
    }
  );

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPostImages(result.assets.slice(0, 5));
    }
  };

  const pickVideos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.7,
      videoMaxDuration: 180,
    });

    if (!result.canceled) {
      const valid = [];
      for (const asset of result.assets) {
        const dur = asset.duration || 0;
        const durationSeconds = dur > 10000 ? Math.round(dur / 1000) : Math.round(dur);
        if (durationSeconds > 180) {
          Alert.alert('⏱️ Video Too Long', `Max 3 minutes allowed. Your video is ${durationSeconds}s. Please trim it.`);
          continue;
        }
        valid.push(asset);
      }
      setPostVideos(valid.slice(0, 3));
    }
  };

  const createPost = async () => {
    if (!postText.trim() && postImages.length === 0 && postVideos.length === 0) {
      Alert.alert('Empty Post', 'Please add some text, images, or videos.');
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      if (postText.trim()) formData.append('text', postText.trim());

      postImages.forEach((img, index) => {
        formData.append('images', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `post_image_${index}.jpg`,
        });
      });

      const videoDurations = [];
      postVideos.forEach((vid, index) => {
        formData.append('videos', {
          uri: vid.uri,
          type: 'video/mp4',
          name: `post_video_${index}.mp4`,
        });
        const dur = vid.duration || 0;
        videoDurations.push(dur > 10000 ? Math.round(dur / 1000) : Math.round(dur));
      });
      if (videoDurations.length > 0) formData.append('videoDurations', JSON.stringify(videoDurations));

      await postsAPI.createPost(formData);
      setPostText('');
      setPostImages([]);
      setPostVideos([]);
      setShowCreate(false);
      loadPosts(1, true);
      Alert.alert('Success', 'Post created!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create post.');
    } finally {
      setCreating(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await postsAPI.likePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
              ...p,
              isLiked: response.data.liked,
              likesCount: p.likesCount + (response.data.liked ? 1 : -1),
            }
            : p
        )
      );
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleShare = async (post) => {
    try {
      const message = post.text
        ? `${post.text}\n\n- Shared from Apna Shahkot`
        : 'Check out this post from Apna Shahkot!';
      await Share.share({
        message,
        title: 'Apna Shahkot',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = async (postId, isOwner) => {
    const deleteType = isOwner ? 'your' : 'this';
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete ${deleteType} post?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isOwner) {
                await postsAPI.deletePost(postId);
              } else {
                // Admin delete
                const { adminAPI } = require('../services/api');
                await adminAPI.deletePost(postId);
              }
              setPosts((prev) => prev.filter((p) => p.id !== postId));
              Alert.alert('Deleted', 'Post has been removed.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post.');
            }
          },
        },
      ]
    );
  };

  const openComments = async (post) => {
    setSelectedPost(post);
    setShowCommentsModal(true);
    setLoadingComments(true);
    try {
      const response = await postsAPI.getComments(post.id);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Load comments error:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedPost) return;
    setAddingComment(true);
    try {
      await postsAPI.addComment(selectedPost.id, newComment.trim());
      setNewComment('');
      // Reload comments
      const response = await postsAPI.getComments(selectedPost.id);
      setComments(response.data.comments || []);
      // Update comment count in posts list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const renderPost = ({ item }) => {
    const isOwner = item.user?.id === user?.id;
    const canDelete = isOwner || isAdmin;

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          {item.user?.photoUrl ? (
            <Image source={{ uri: item.user.photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.user?.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.postUserName}>{item.user?.name}</Text>
            <Text style={styles.postTime}>
              {new Date(item.createdAt).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>
          {canDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id, isOwner)}>
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Post Text */}
        {item.text && <Text style={styles.postText}>{item.text}</Text>}

        {/* Post Images */}
        {item.images?.length > 0 && (
          <View style={styles.imageContainer}>
            {item.images.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.postImage} resizeMode="cover" />
            ))}
          </View>
        )}

        {/* Post Videos */}
        {item.videos?.length > 0 && (
          <View style={styles.videoContainer}>
            {item.videos.map((uri, idx) => (
              <View key={idx} style={styles.videoWrapper}>
                <Video
                  source={{ uri }}
                  style={styles.videoPlayer}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  shouldPlay={false}
                  onError={(e) => console.log('Video error:', e)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id)}>
            <Text style={styles.actionIcon}>{item.isLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionText}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => openComments(item)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
            <Text style={styles.actionIcon}>↗️</Text>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Create Post Button - Animated */}
      <Animated.View
        style={[
          styles.createBar,
          {
            opacity: headerHeight,
            maxHeight: headerHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 100],
            }),
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => setShowCreate(!showCreate)}
        >
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.miniAvatar} />
          ) : (
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>{user?.name?.[0] || '?'}</Text>
            </View>
          )}
          <Text style={styles.createPlaceholder}>What's on your mind?</Text>
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Watch Videos Button - Animated */}
      <Animated.View
        style={[
          {
            opacity: headerHeight,
            maxHeight: headerHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 100],
            }),
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.watchVideosBtn}
          onPress={() => navigation.navigate('VideoFeed')}
        >
          <Text style={styles.watchVideosIcon}>🎬</Text>
          <Text style={styles.watchVideosText}>Watch Videos</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Create Post Form */}
      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.createInput}
            placeholder="Write something..."
            value={postText}
            onChangeText={setPostText}
            multiline
            maxLength={1000}
            placeholderTextColor={COLORS.textLight}
          />
          {postImages.length > 0 && (
            <View style={styles.previewRow}>
              {postImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img.uri }} style={styles.previewImage} />
              ))}
            </View>
          )}
          {postVideos.length > 0 && (
            <View style={styles.previewRow}>
              {postVideos.map((vid, idx) => (
                <View key={idx} style={styles.videoPreview}>
                  <Text style={styles.videoPreviewIcon}>🎬</Text>
                  <Text style={styles.videoPreviewText}>Video {idx + 1}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.createActions}>
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.imagePickButton} onPress={pickImages}>
                <Text>📷 Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imagePickButton} onPress={pickVideos}>
                <Text>🎬 Videos</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.postButton, creating && styles.postButtonDisabled]}
              onPress={createPost}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )
      }

      {/* Posts Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No posts yet. Be the first to post!</Text>
            </View>
          )
        }
        ListFooterComponent={loading && page > 1 && <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Comments Modal */}
      <Modal visible={showCommentsModal} animationType="slide" onRequestClose={() => setShowCommentsModal(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loadingComments ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  {item.user?.photoUrl ? (
                    <Image source={{ uri: item.user.photoUrl }} style={styles.commentAvatar} />
                  ) : (
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{item.user?.name?.[0] || '?'}</Text>
                    </View>
                  )}
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUser}>{item.user?.name}</Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                    <Text style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleDateString('en-PK', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                </View>
              }
              contentContainerStyle={{ padding: 12 }}
            />
          )}

          {/* Add Comment */}
          <View style={styles.addCommentRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              value={newComment}
              onChangeText={setNewComment}
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newComment.trim() || addingComment) && styles.sendButtonDisabled]}
              onPress={addComment}
              disabled={!newComment.trim() || addingComment}
            >
              {addingComment ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  createBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 12,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniAvatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  createPlaceholder: { flex: 1, color: COLORS.textLight, fontSize: 15 },
  cameraIcon: { fontSize: 22 },
  createForm: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  createInput: {
    fontSize: 16,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  videoPreview: { width: 60, height: 60, borderRadius: 8, backgroundColor: COLORS.gray, justifyContent: 'center', alignItems: 'center' },
  videoPreviewIcon: { fontSize: 24 },
  videoPreviewText: { fontSize: 10, color: COLORS.textLight },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  imagePickButton: {
    padding: 8,
  },
  mediaButtons: { flexDirection: 'row', gap: 10 },
  postButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { color: COLORS.white, fontWeight: '700' },
  postCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deleteButton: { padding: 6 },
  deleteIcon: { fontSize: 18 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  avatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 18 },
  postUserName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  postTime: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  postText: { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 10 },
  imageContainer: { marginBottom: 10, gap: 4 },
  postImage: { width: '100%', height: 250, borderRadius: 10 },
  videoContainer: { marginBottom: 10, gap: 8 },
  videoWrapper: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: 220,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  actionIcon: { fontSize: 18, marginRight: 4 },
  actionText: { fontSize: 13, color: COLORS.textSecondary },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  // Watch Videos Button
  watchVideosBtn: {
    backgroundColor: COLORS.primary,
    margin: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  watchVideosIcon: { fontSize: 20, marginRight: 8 },
  watchVideosText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalClose: { fontSize: 22, color: COLORS.textSecondary, padding: 4 },
  commentItem: { flexDirection: 'row', marginBottom: 16 },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAvatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
  commentContent: { flex: 1 },
  commentUser: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  commentText: { fontSize: 14, color: COLORS.text, marginTop: 2 },
  commentTime: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  addCommentRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: COLORS.white, fontWeight: '600' },
});
