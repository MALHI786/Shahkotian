import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Image, Modal, Animated, ActivityIndicator, FlatList, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, PRIVACY_OPTIONS, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_MB } from '../config/constants';
import { postsAPI } from '../services/api';

export default function PostComposer({
    user,
    visible,
    onClose,
    onPostCreated,
}) {
    const [text, setText] = useState('');
    const [images, setImages] = useState([]);
    const [videos, setVideos] = useState([]);
    const [privacy, setPrivacy] = useState('PUBLIC');
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Mention state
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionUsers, setMentionUsers] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const inputRef = useRef(null);
    const expandAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(expandAnim, {
                toValue: 1,
                damping: 15,
                useNativeDriver: true,
            }).start();
        } else {
            expandAnim.setValue(0);
        }
    }, [visible]);

    // Detect @mentions
    useEffect(() => {
        const mentionMatch = text.match(/@(\w*)$/);
        if (mentionMatch && mentionMatch[1].length >= 2) {
            setMentionQuery(mentionMatch[1]);
            setShowMentions(true);
            searchUsers(mentionMatch[1]);
        } else {
            setShowMentions(false);
            setMentionUsers([]);
        }
    }, [text]);

    const searchUsers = async (query) => {
        if (query.length < 2) return;
        setSearchingUsers(true);
        try {
            const response = await postsAPI.searchUsers(query);
            setMentionUsers(response.data.users || []);
        } catch (error) {
            console.error('Search users error:', error);
        } finally {
            setSearchingUsers(false);
        }
    };

    const selectMention = (user) => {
        const newText = text.replace(/@\w*$/, `@${user.name} `);
        setText(newText);
        setShowMentions(false);
        setMentionUsers([]);
        inputRef.current?.focus();
    };

    const pickImages = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages([...images, ...result.assets].slice(0, 5));
        }
    };

    const pickVideos = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: true,
                selectionLimit: 3 - videos.length,
                quality: 0.3, // Lower quality for better compression
                videoMaxDuration: MAX_VIDEO_DURATION_SECONDS, // 3 minutes
                videoQuality: 0, // 0 = low quality (smaller file size)
            });

            if (!result.canceled) {
                const validVideos = [];
                for (const asset of result.assets) {
                    // asset.duration may be in seconds or milliseconds depending on platform
                    const dur = asset.duration || 0;
                    const durationSeconds = dur > 10000 ? Math.round(dur / 1000) : Math.round(dur);
                    const fileSizeMB = asset.fileSize ? (asset.fileSize / (1024 * 1024)).toFixed(1) : 'Unknown';
                    
                    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
                        Alert.alert(
                            '⏱️ Video Too Long', 
                            `This video is ${durationSeconds} seconds long. Maximum is ${MAX_VIDEO_DURATION_SECONDS} seconds (3 minutes).\n\nPlease trim it and try again.`
                        );
                        continue;
                    }
                    if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
                        Alert.alert(
                            '📦 Video File Too Large', 
                            `This video is ${fileSizeMB}MB. Maximum file size is ${MAX_VIDEO_SIZE_MB}MB.\n\nTip: Record videos at lower quality (720p instead of 4K) to reduce file size, or use a video compressor app.`
                        );
                        continue;
                    }
                    validVideos.push(asset);
                }

                if (validVideos.length > 0) setVideos([...videos, ...validVideos].slice(0, 3));
            }
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const removeVideo = (index) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    const createPost = async () => {
        if (!text.trim() && images.length === 0 && videos.length === 0) return;

        setCreating(true);
        try {
            const formData = new FormData();
            if (text.trim()) formData.append('text', text.trim());
            formData.append('privacy', privacy);

            images.forEach((img, index) => {
                formData.append('images', {
                    uri: img.uri,
                    type: 'image/jpeg',
                    name: `post_image_${index}.jpg`,
                });
            });

            const durations = [];
            videos.forEach((vid, index) => {
                formData.append('videos', {
                    uri: vid.uri,
                    type: 'video/mp4',
                    name: `post_video_${index}.mp4`,
                });
                const dur = vid.duration || 0;
                durations.push(dur > 10000 ? Math.round(dur / 1000) : Math.round(dur));
            });
            if (durations.length > 0) formData.append('videoDurations', JSON.stringify(durations));

            const response = await postsAPI.createPost(formData);

            // Reset form
            setText('');
            setImages([]);
            setVideos([]);
            setPrivacy('PUBLIC');

            onPostCreated?.(response.data.post);
            onClose();
        } catch (error) {
            console.error('Create post error:', error);
            alert(error.response?.data?.error || 'Failed to create post');
        } finally {
            setCreating(false);
        }
    };

    const canPost = text.trim() || images.length > 0 || videos.length > 0;
    const selectedPrivacy = PRIVACY_OPTIONS.find(p => p.key === privacy);

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <Animated.View style={[styles.container, {
                opacity: expandAnim,
                transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }]
            }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Create Post</Text>
                    <TouchableOpacity
                        style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
                        onPress={() => setShowPreview(true)}
                        disabled={!canPost || creating}
                    >
                        <Text style={styles.postBtnText}>Preview</Text>
                    </TouchableOpacity>
                </View>

                {/* User Info */}
                <View style={styles.userRow}>
                    {user?.photoUrl ? (
                        <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.name}</Text>
                        <TouchableOpacity style={styles.privacyBtn} onPress={() => setShowPrivacy(true)}>
                            <Text style={styles.privacyIcon}>{selectedPrivacy?.icon}</Text>
                            <Text style={styles.privacyLabel}>{selectedPrivacy?.label}</Text>
                            <Text style={styles.dropdownIcon}>▼</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Text Input */}
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder="What's on your mind?"
                    placeholderTextColor={COLORS.textLight}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    autoFocus
                />

                {/* Mention Suggestions */}
                {showMentions && (
                    <View style={styles.mentionsContainer}>
                        {searchingUsers ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                            <FlatList
                                data={mentionUsers}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.mentionItem} onPress={() => selectMention(item)}>
                                        {item.photoUrl ? (
                                            <Image source={{ uri: item.photoUrl }} style={styles.mentionAvatar} />
                                        ) : (
                                            <View style={styles.mentionAvatarPlaceholder}>
                                                <Text style={styles.mentionAvatarText}>{item.name[0]}</Text>
                                            </View>
                                        )}
                                        <Text style={styles.mentionName}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.noMentions}>No users found</Text>
                                }
                            />
                        )}
                    </View>
                )}

                {/* Image Previews */}
                {images.length > 0 && (
                    <View style={styles.previewRow}>
                        {images.map((img, idx) => (
                            <View key={idx} style={styles.previewItem}>
                                <Image source={{ uri: img.uri }} style={styles.previewImage} />
                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                                    <Text style={styles.removeIcon}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Video Previews */}
                {videos.length > 0 && (
                    <View style={styles.previewRow}>
                        {videos.map((vid, idx) => (
                            <View key={idx} style={styles.videoPreview}>
                                <Text style={styles.videoIcon}>🎬</Text>
                                <Text style={styles.videoLabel}>Video {idx + 1}</Text>
                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeVideo(idx)}>
                                    <Text style={styles.removeIcon}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Media Buttons */}
                <View style={styles.mediaBar}>
                    <Text style={styles.mediaTitle}>Add to your post</Text>
                    <View style={styles.mediaButtons}>
                        <TouchableOpacity style={styles.mediaBtn} onPress={pickImages} disabled={images.length >= 5}>
                            <Text style={styles.mediaBtnIcon}>📷</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn} onPress={pickVideos} disabled={videos.length >= 3}>
                            <Text style={styles.mediaBtnIcon}>🎬</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Text style={styles.mediaBtnIcon}>📍</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Privacy Modal */}
                <Modal visible={showPrivacy} transparent animationType="fade" onRequestClose={() => setShowPrivacy(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPrivacy(false)}>
                        <View style={styles.privacyModal}>
                            <Text style={styles.privacyTitle}>Who can see your post?</Text>
                            {PRIVACY_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.privacyOption, privacy === option.key && styles.privacyOptionActive]}
                                    onPress={() => { setPrivacy(option.key); setShowPrivacy(false); }}
                                >
                                    <Text style={styles.privacyOptionIcon}>{option.icon}</Text>
                                    <View style={styles.privacyOptionInfo}>
                                        <Text style={styles.privacyOptionLabel}>{option.label}</Text>
                                        <Text style={styles.privacyOptionDesc}>{option.description}</Text>
                                    </View>
                                    {privacy === option.key && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Post Preview Modal */}
                <Modal visible={showPreview} animationType="slide" transparent onRequestClose={() => setShowPreview(false)}>
                    <View style={styles.previewOverlay}>
                        <View style={styles.previewCard}>
                            <Text style={styles.previewTitle}>Post Preview</Text>
                            <View style={styles.previewUserRow}>
                                {user?.photoUrl ? (
                                    <Image source={{ uri: user.photoUrl }} style={styles.previewAvatar} />
                                ) : (
                                    <View style={[styles.previewAvatar, { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>{user?.name?.[0]}</Text>
                                    </View>
                                )}
                                <Text style={styles.previewUserName}>{user?.name}</Text>
                            </View>
                            {text.trim() ? <Text style={styles.previewText}>{text}</Text> : null}
                            {images.length > 0 && (
                                <FlatList
                                    horizontal
                                    data={images}
                                    keyExtractor={(_, i) => `prev_img_${i}`}
                                    renderItem={({ item }) => (
                                        <Image source={{ uri: item.uri }} style={styles.previewThumb} />
                                    )}
                                    style={{ marginTop: 10 }}
                                />
                            )}
                            {videos.length > 0 && (
                                <Text style={styles.previewVideoTag}>🎬 {videos.length} video(s) attached</Text>
                            )}
                            <View style={styles.previewActions}>
                                <TouchableOpacity style={styles.previewEditBtn} onPress={() => setShowPreview(false)}>
                                    <Text style={styles.previewEditText}>{'<'} Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.previewPublishBtn}
                                    onPress={() => { setShowPreview(false); createPost(); }}
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <ActivityIndicator size="small" color={COLORS.white} />
                                    ) : (
                                        <Text style={styles.previewPublishText}>Publish Post</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 22, color: COLORS.textSecondary },
    title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    postBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    postBtnDisabled: { opacity: 0.5 },
    postBtnText: { color: COLORS.white, fontWeight: '700' },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: COLORS.surface,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
    userInfo: { marginLeft: 12 },
    userName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    privacyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.gray,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
    },
    privacyIcon: { fontSize: 12, marginRight: 4 },
    privacyLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
    dropdownIcon: { fontSize: 8, color: COLORS.textLight, marginLeft: 4 },
    input: {
        flex: 1,
        fontSize: 18,
        color: COLORS.text,
        padding: 16,
        textAlignVertical: 'top',
        backgroundColor: COLORS.surface,
        minHeight: 150,
    },
    mentionsContainer: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        maxHeight: 200,
        padding: 8,
    },
    mentionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
    },
    mentionAvatar: { width: 32, height: 32, borderRadius: 16 },
    mentionAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mentionAvatarText: { color: COLORS.white, fontWeight: 'bold' },
    mentionName: { marginLeft: 10, fontSize: 15, fontWeight: '600', color: COLORS.text },
    noMentions: { padding: 16, color: COLORS.textLight, textAlign: 'center' },
    previewRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 8,
        backgroundColor: COLORS.surface,
    },
    previewItem: { position: 'relative' },
    previewImage: { width: 80, height: 80, borderRadius: 8 },
    videoPreview: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: COLORS.gray,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    videoIcon: { fontSize: 24 },
    videoLabel: { fontSize: 10, color: COLORS.textLight },
    removeBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeIcon: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
    mediaBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: 'auto',
    },
    mediaTitle: { fontSize: 14, color: COLORS.textSecondary },
    mediaButtons: { flexDirection: 'row', gap: 12 },
    mediaBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.gray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaBtnIcon: { fontSize: 22 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    privacyModal: {
        width: '85%',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
    },
    privacyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
    privacyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    privacyOptionActive: { backgroundColor: COLORS.primaryLight + '20' },
    privacyOptionIcon: { fontSize: 24, marginRight: 12 },
    privacyOptionInfo: { flex: 1 },
    privacyOptionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    privacyOptionDesc: { fontSize: 13, color: COLORS.textLight },
    checkmark: { fontSize: 18, color: COLORS.primary, fontWeight: 'bold' },
    // Preview styles
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    previewCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 20,
        maxHeight: '80%',
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    previewUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    previewAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    previewUserName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    previewText: {
        fontSize: 15,
        color: COLORS.text,
        lineHeight: 22,
    },
    previewThumb: {
        width: 90,
        height: 90,
        borderRadius: 10,
        marginRight: 8,
    },
    previewVideoTag: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    previewActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    previewEditBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    previewEditText: {
        fontWeight: '700',
        color: COLORS.text,
        fontSize: 15,
    },
    previewPublishBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: COLORS.primary,
    },
    previewPublishText: {
        fontWeight: '700',
        color: COLORS.white,
        fontSize: 15,
    },
});
