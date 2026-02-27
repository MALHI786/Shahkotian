import React, { useState, useRef } from 'react';
import {
    View, Text, Image, TouchableOpacity, StyleSheet,
    Animated, Share, Linking, Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, ANIMATIONS } from '../config/constants';
import ImageViewer from './ImageViewer';

const { width } = Dimensions.get('window');
const MAX_TEXT_LENGTH = 200;

export default function PostCard({
    post,
    currentUserId,
    isAdmin,
    onLike,
    onComment,
    onRepost,
    onDelete,
}) {
    const [expanded, setExpanded] = useState(false);
    const [likeAnim] = useState(new Animated.Value(1));
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const isOwner = post.user?.id === currentUserId;
    const canDelete = isAdmin; // Only admin can delete posts
    const hasLongText = post.text && post.text.length > MAX_TEXT_LENGTH;
    const isRepost = !!post.repostOf;

    const animateLike = () => {
        Animated.sequence([
            Animated.timing(likeAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
            Animated.timing(likeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        onLike(post.id);
    };

    const handleShare = async () => {
        try {
            const message = post.text
                ? `${post.text}\n\n- Shared from Apna Shahkot`
                : 'Check out this post from Apna Shahkot!';
            await Share.share({ message, title: 'Apna Shahkot' });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const shareToWhatsApp = () => {
        const text = encodeURIComponent(post.text || 'Check out this post from Apna Shahkot!');
        Linking.openURL(`whatsapp://send?text=${text}`);
    };

    const displayText = expanded || !hasLongText
        ? post.text
        : post.text.substring(0, MAX_TEXT_LENGTH) + '...';

    return (
        <View style={styles.card}>
            {/* Repost Header */}
            {isRepost && (
                <View style={styles.repostHeader}>
                    <Text style={styles.repostIcon}>🔄</Text>
                    <Text style={styles.repostText}>{post.user?.name} reposted</Text>
                </View>
            )}

            {/* Post Header */}
            <View style={styles.header}>
                {post.user?.photoUrl ? (
                    <Image source={{ uri: post.user.photoUrl }} style={styles.avatarImg} />
                ) : (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{post.user?.name?.[0] || '?'}</Text>
                    </View>
                )}
                <View style={styles.headerInfo}>
                    <Text style={styles.userName}>{post.user?.name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.timeText}>{post.relativeTime || 'Just now'}</Text>
                        {post.privacy && post.privacy !== 'PUBLIC' && (
                            <Text style={styles.privacyIcon}>
                                {post.privacy === 'FRIENDS' ? ' 👥' : ' 🔒'}
                            </Text>
                        )}
                    </View>
                </View>
                {canDelete && (
                    <TouchableOpacity style={styles.moreBtn} onPress={() => onDelete(post.id, isOwner)}>
                        <Text style={styles.moreIcon}>⋮</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Reposted Content Card */}
            {isRepost && post.repostOf && (
                <View style={styles.repostedContent}>
                    <View style={styles.repostedHeader}>
                        {post.repostOf.user?.photoUrl ? (
                            <Image source={{ uri: post.repostOf.user.photoUrl }} style={styles.repostedAvatar} />
                        ) : (
                            <View style={styles.repostedAvatarPlaceholder}>
                                <Text style={styles.repostedAvatarText}>{post.repostOf.user?.name?.[0]}</Text>
                            </View>
                        )}
                        <Text style={styles.repostedUserName}>{post.repostOf.user?.name}</Text>
                    </View>
                    {post.repostOf.text && <Text style={styles.repostedText}>{post.repostOf.text}</Text>}
                    {post.repostOf.images?.[0] && (
                        <Image source={{ uri: post.repostOf.images[0] }} style={styles.repostedImage} />
                    )}
                </View>
            )}

            {/* Post Text */}
            {post.text && !isRepost && (
                <View style={styles.textContainer}>
                    <Text style={styles.postText}>{displayText}</Text>
                    {hasLongText && (
                        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                            <Text style={styles.seeMore}>{expanded ? 'See less' : 'See more'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Images */}
            {post.images?.length > 0 && !isRepost && (
                <View style={styles.mediaContainer}>
                    {post.images.map((uri, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            onPress={() => {
                                setSelectedImageIndex(idx);
                                setImageViewerVisible(true);
                            }}
                            activeOpacity={0.9}
                        >
                            <Image source={{ uri }} style={styles.postImage} resizeMode="cover" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Videos */}
            {post.videos?.length > 0 && !isRepost && (
                <View style={styles.mediaContainer}>
                    {post.videos.map((uri, idx) => (
                        <View key={idx} style={styles.videoWrapper}>
                            <Video
                                source={{ uri }}
                                style={styles.postVideo}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping={false}
                            />
                        </View>
                    ))}
                </View>
            )}

            {/* Counters */}
            <View style={styles.counters}>
                <Text style={styles.counterText}>
                    {post.likesCount || 0} Likes • {post.commentsCount || 0} Comments
                    {(post.repostsCount || 0) > 0 && ` • ${post.repostsCount} Reposts`}
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={animateLike}>
                    <Animated.Text style={[styles.actionIcon, { transform: [{ scale: likeAnim }] }]}>
                        {post.isLiked ? '❤️' : '🤍'}
                    </Animated.Text>
                    <Text style={[styles.actionLabel, post.isLiked && styles.likedLabel]}>Like</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post)}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionLabel}>Comment</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => onRepost(post.id)}>
                    <Text style={styles.actionIcon}>🔄</Text>
                    <Text style={styles.actionLabel}>Repost</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                    <Text style={styles.actionIcon}>↗️</Text>
                    <Text style={styles.actionLabel}>Share</Text>
                </TouchableOpacity>
            </View>

            {/* Image Viewer Modal */}
            <ImageViewer
                images={post.images || []}
                visible={imageViewerVisible}
                initialIndex={selectedImageIndex}
                onClose={() => setImageViewerVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 16,
        paddingVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    repostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        marginBottom: 12,
    },
    repostIcon: { fontSize: 14, marginRight: 6 },
    repostText: { fontSize: 13, color: COLORS.textSecondary },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 18 },
    headerInfo: { flex: 1, marginLeft: 12 },
    userName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    timeText: { fontSize: 12, color: COLORS.textLight },
    privacyIcon: { fontSize: 12 },
    moreBtn: { padding: 8 },
    moreIcon: { fontSize: 20, color: COLORS.textSecondary },
    repostedContent: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        backgroundColor: COLORS.gray,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    repostedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    repostedAvatar: { width: 24, height: 24, borderRadius: 12 },
    repostedAvatarPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    repostedAvatarText: { fontSize: 12, color: COLORS.white, fontWeight: 'bold' },
    repostedUserName: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: COLORS.text },
    repostedText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
    repostedImage: { width: '100%', height: 120, borderRadius: 8 },
    textContainer: { paddingHorizontal: 16, marginBottom: 12 },
    postText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
    seeMore: { color: COLORS.primary, fontWeight: '600', marginTop: 4 },
    mediaContainer: { marginBottom: 12, gap: 4 },
    postImage: { width: '100%', height: 280, borderRadius: 0 },
    videoWrapper: { width: '100%', backgroundColor: '#000' },
    postVideo: { width: '100%', height: 220 },
    counters: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    counterText: { fontSize: 13, color: COLORS.textSecondary },
    actions: {
        flexDirection: 'row',
        paddingTop: 6,
        paddingHorizontal: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    actionIcon: { fontSize: 16, marginRight: 4 },
    actionLabel: { fontSize: 12, color: COLORS.textSecondary },
    likedLabel: { color: COLORS.secondary },
});
