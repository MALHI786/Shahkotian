import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    StatusBar,
    Share,
    Animated,
    Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { postsAPI } from '../services/api';
import { COLORS } from '../config/constants';

const { width, height } = Dimensions.get('window');
const VIDEO_HEIGHT = height - (StatusBar.currentHeight || 0);

const VideoFeedScreen = ({ navigation }) => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const insets = useSafeAreaInsets();
    const flatListRef = useRef(null);

    const loadVideos = useCallback(async (pageNum = 1, refresh = false) => {
        try {
            if (refresh) setRefreshing(true);
            else if (pageNum === 1) setLoading(true);

            const response = await postsAPI.getVideos(pageNum);
            const newVideos = response.data?.videos || [];

            if (refresh || pageNum === 1) {
                setVideos(newVideos);
            } else {
                setVideos(prev => [...prev, ...newVideos]);
            }

            setHasMore(newVideos.length >= 5);
            setPage(pageNum);
        } catch (error) {
            console.error('Load videos error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadVideos(1);
    }, []);

    const handleRefresh = () => loadVideos(1, true);
    const handleLoadMore = () => {
        if (hasMore && !loading && !refreshing) {
            loadVideos(page + 1);
        }
    };

    const handleLike = async (videoId) => {
        try {
            await postsAPI.likePost(videoId);
            setVideos(prev => prev.map(v =>
                v.id === videoId
                    ? { ...v, isLiked: !v.isLiked, likesCount: v.isLiked ? v.likesCount - 1 : v.likesCount + 1 }
                    : v
            ));
        } catch (error) {
            console.error('Like error:', error);
        }
    };

    const handleShare = async (video) => {
        try {
            await Share.share({
                message: `Check out this video from ${video.user?.name || 'Apna Shahkot'}!\n${video.text || ''}`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleDownload = async (video) => {
        try {
            const videoUrl = video.videos?.[0];
            if (!videoUrl) return Alert.alert('Error', 'No video to download.');

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                return Alert.alert('Permission Required', 'Gallery access is needed to save videos.');
            }

            Alert.alert('⬇️ Downloading', 'Video download shuru ho gaya...');

            const filename = `shahkot_video_${Date.now()}.mp4`;
            const fileUri = FileSystem.documentDirectory + filename;

            const downloadResult = await FileSystem.downloadAsync(videoUrl, fileUri);

            const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
            await MediaLibrary.createAlbumAsync('Apna Shahkot', asset, false);

            Alert.alert('✅ Saved!', 'Video gallery mein save ho gaya.');
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Error', 'Download fail ho gaya. Try again.');
        }
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }, []);

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 80,
    };

    const renderVideo = ({ item, index }) => (
        <VideoCard
            video={item}
            isActive={index === currentIndex}
            onLike={() => handleLike(item.id)}
            onShare={() => handleShare(item)}
            onDownload={() => handleDownload(item)}
            onComment={() => Alert.alert('Comments', 'Comments feature coming soon!')}
            onProfile={() => navigation.navigate('UserProfile', { userId: item.userId })}
        />
    );

    if (loading && videos.length === 0) {
        return (
            <View style={styles.loaderContainer}>
                <StatusBar barStyle="light-content" backgroundColor="black" />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loaderText}>Loading videos...</Text>
            </View>
        );
    }

    if (!loading && videos.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <StatusBar barStyle="light-content" backgroundColor="black" />
                <Ionicons name="videocam-off" size={80} color="#555" />
                <Text style={styles.emptyTitle}>No Videos Yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to share a video!</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={26} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Videos</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                ref={flatListRef}
                data={videos}
                renderItem={renderVideo}
                keyExtractor={item => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={VIDEO_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(data, index) => ({
                    length: VIDEO_HEIGHT,
                    offset: VIDEO_HEIGHT * index,
                    index,
                })}
            />
        </View>
    );
};

const VideoCard = ({ video, isActive, onLike, onShare, onDownload, onComment, onProfile }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isActive) {
            videoRef.current?.playAsync();
            setIsPlaying(true);
        } else {
            videoRef.current?.pauseAsync();
            setIsPlaying(false);
        }
    }, [isActive]);

    const handleVideoPress = async () => {
        if (isPlaying) {
            await videoRef.current?.pauseAsync();
        } else {
            await videoRef.current?.playAsync();
        }
        setIsPlaying(!isPlaying);
    };

    const animateLike = () => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        onLike();
    };

    const videoUrl = video.videos?.[0] || '';

    return (
        <View style={styles.videoCard}>
            <TouchableOpacity activeOpacity={0.95} onPress={handleVideoPress} style={styles.videoWrapper}>
                {videoUrl ? (
                    <Video
                        ref={videoRef}
                        source={{ uri: videoUrl }}
                        style={styles.video}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={isActive}
                        useNativeControls={false}
                    />
                ) : (
                    <View style={styles.noVideo}>
                        <Ionicons name="videocam-off" size={60} color="#666" />
                    </View>
                )}

                {/* Play/Pause Indicator */}
                {!isPlaying && isActive && (
                    <View style={styles.playIndicator}>
                        <Ionicons name="play" size={60} color="rgba(255,255,255,0.8)" />
                    </View>
                )}
            </TouchableOpacity>

            {/* Gradient Overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
                style={styles.gradient}
                pointerEvents="none"
            />

            {/* User Info & Caption */}
            <View style={styles.infoContainer}>
                <TouchableOpacity style={styles.userRow} onPress={onProfile}>
                    <Image
                        source={{ uri: video.user?.photoUrl || 'https://ui-avatars.com/api/?name=' + (video.user?.name || 'User') }}
                        style={styles.avatar}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{video.user?.name || 'Anonymous'}</Text>
                        <Text style={styles.timeText}>{video.relativeTime}</Text>
                    </View>
                </TouchableOpacity>
                {video.text && (
                    <Text style={styles.caption} numberOfLines={3}>{video.text}</Text>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionBtn} onPress={animateLike}>
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <Ionicons
                            name={video.isLiked ? 'heart' : 'heart-outline'}
                            size={32}
                            color={video.isLiked ? '#FF4757' : 'white'}
                        />
                    </Animated.View>
                    <Text style={styles.actionText}>{video.likesCount || 0}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
                    <Ionicons name="chatbubble-ellipses-outline" size={30} color="white" />
                    <Text style={styles.actionText}>{video.commentsCount || 0}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
                    <Ionicons name="share-social-outline" size={30} color="white" />
                    <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={onDownload}>
                    <Ionicons name="download-outline" size={30} color="white" />
                    <Text style={styles.actionText}>Save</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    loaderContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        color: '#888',
        marginTop: 15,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
    },
    emptySubtitle: {
        color: '#888',
        fontSize: 16,
        marginTop: 10,
        textAlign: 'center',
    },
    backButton: {
        marginTop: 30,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    backButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    videoCard: {
        width,
        height: VIDEO_HEIGHT,
        backgroundColor: 'black',
    },
    videoWrapper: {
        flex: 1,
    },
    video: {
        width: '100%',
        height: '100%',
    },
    noVideo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
    },
    playIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 250,
    },
    infoContainer: {
        position: 'absolute',
        bottom: 100,
        left: 15,
        right: 70,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: 'white',
    },
    userInfo: {
        marginLeft: 12,
    },
    userName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    timeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 2,
    },
    caption: {
        color: 'white',
        fontSize: 14,
        lineHeight: 20,
    },
    actionsContainer: {
        position: 'absolute',
        bottom: 120,
        right: 12,
        alignItems: 'center',
    },
    actionBtn: {
        alignItems: 'center',
        marginBottom: 20,
    },
    actionText: {
        color: 'white',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
});

export default VideoFeedScreen;
