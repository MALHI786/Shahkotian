import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image,
    KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, Keyboard, Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../services/api';

// Discord-like dark theme
const COLORS = {
    bg: '#0D1117',
    surface: '#161B22',
    card: '#1C2333',
    primary: '#5865F2', // Discord blue
    text: '#DCDDDE',
    textMuted: '#72767D',
    textDim: 'rgba(255,255,255,0.45)',
    border: '#40444B',
    sent: '#5865F2',
    received: '#2F3136',
    accent: '#ED4245', // Discord red
    success: '#3BA55C', // Discord green
    warning: '#FAA61A',
    reaction: '#2F3136',
    online: '#3BA55C',
};

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

export default function OpenChatScreen({ navigation }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [selectedImages, setSelectedImages] = useState([]);
    const [replyTo, setReplyTo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [profileModal, setProfileModal] = useState(null);
    const [menuMsg, setMenuMsg] = useState(null);
    const [showReactions, setShowReactions] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const flatListRef = useRef(null);
    const pollRef = useRef(null);
    const recordingRef = useRef(null);
    const recordingTimerRef = useRef(null);

    // Load messages
    const loadMessages = useCallback(async (pageNum = 1, append = false) => {
        try {
            const res = await chatAPI.getMessages(pageNum);
            const msgs = res.data.messages || [];
            if (append) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMsgs = msgs.filter(m => !existingIds.has(m.id));
                    return [...newMsgs, ...prev];
                });
            } else {
                setMessages(msgs);
            }
            setHasMore(res.data.pagination?.page < res.data.pagination?.totalPages);
        } catch (err) {
            console.error('Load messages err:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + polling (5s for more real-time feel)
    useEffect(() => {
        loadMessages(1);
        pollRef.current = setInterval(() => loadMessages(1), 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Pick images
    const pickImages = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                selectionLimit: 4,
                quality: 0.7,
            });
            if (!result.canceled && result.assets) {
                setSelectedImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 4));
            }
        } catch (err) {
            Alert.alert('Error', 'Could not pick images.');
        }
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant microphone access to record voice messages.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recording.startAsync();
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Recording error:', err);
            Alert.alert('Error', 'Could not start recording.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        clearInterval(recordingTimerRef.current);
        setIsRecording(false);

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            if (uri && recordingDuration > 0) {
                sendVoiceMessage(uri);
            }
        } catch (err) {
            console.error('Stop recording error:', err);
        }
    };

    const cancelRecording = async () => {
        if (!recordingRef.current) return;

        clearInterval(recordingTimerRef.current);
        setIsRecording(false);

        try {
            await recordingRef.current.stopAndUnloadAsync();
            recordingRef.current = null;
        } catch (err) {
            console.error('Cancel recording error:', err);
        }
    };

    const sendVoiceMessage = async (uri) => {
        setSending(true);
        try {
            await chatAPI.sendMessage({
                text: `🎤 Voice Message (${recordingDuration}s)`,
                images: [],
                voiceUri: uri,
                replyToId: replyTo?.id || null,
            });
            setReplyTo(null);
            await loadMessages(1);
        } catch (err) {
            Alert.alert('Error', 'Failed to send voice message.');
        } finally {
            setSending(false);
            setRecordingDuration(0);
        }
    };

    // Send message
    const sendMessage = async () => {
        const msgText = text.trim();
        if (!msgText && selectedImages.length === 0) return;
        if (sending) return;

        setSending(true);
        Keyboard.dismiss();
        try {
            await chatAPI.sendMessage({
                text: msgText || null,
                images: selectedImages,
                replyToId: replyTo?.id || null,
            });
            setText('');
            setSelectedImages([]);
            setReplyTo(null);
            await loadMessages(1);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    // React to message
    const reactToMessage = async (msgId, emoji) => {
        try {
            // Optimistic update
            setMessages(prev => prev.map(m => {
                if (m.id === msgId) {
                    const reactions = m.reactions || {};
                    if (reactions[emoji]?.includes(user?.id)) {
                        reactions[emoji] = reactions[emoji].filter(id => id !== user?.id);
                        if (reactions[emoji].length === 0) delete reactions[emoji];
                    } else {
                        reactions[emoji] = [...(reactions[emoji] || []), user?.id];
                    }
                    return { ...m, reactions };
                }
                return m;
            }));
            await chatAPI.reactToMessage?.(msgId, emoji);
        } catch (err) {
            console.error('React error:', err);
        }
        setShowReactions(null);
    };

    // Share message
    const shareMessage = async (msg) => {
        try {
            const shareContent = msg.text || 'Check out this message from Shahkot Open Chat!';
            await Share.share({
                message: `${shareContent}\n\n— Shared from Shahkot Tiger App`,
            });
        } catch (err) {
            console.error('Share error:', err);
        }
        setMenuMsg(null);
    };

    // Like message (quick reaction)
    const likeMessage = (msg) => {
        reactToMessage(msg.id, '❤️');
        setMenuMsg(null);
    };

    // Report message
    const reportMessage = (msg) => {
        Alert.alert('Report', 'Report this message as inappropriate?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Report', style: 'destructive',
                onPress: async () => {
                    try {
                        await chatAPI.reportMessage({ messageId: msg.id, reason: 'Inappropriate content' });
                        Alert.alert('Reported', 'Message reported to admins.');
                    } catch (err) {
                        Alert.alert('Error', 'Failed to report.');
                    }
                },
            },
        ]);
        setMenuMsg(null);
    };

    // View user profile
    const viewProfile = async (userId) => {
        try {
            const res = await chatAPI.getUserProfile(userId);
            setProfileModal(res.data);
        } catch (err) {
            Alert.alert('Error', 'Could not load profile.');
        }
        setMenuMsg(null);
    };

    // Load older messages
    const loadOlder = () => {
        if (!hasMore || loading) return;
        const nextPage = page + 1;
        setPage(nextPage);
        loadMessages(nextPage, true);
    };

    const formatTime = (date) => {
        const d = new Date(date);
        return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderMessage = ({ item }) => {
        const isMine = item.userId === user?.id;
        const reactions = item.reactions || {};
        const hasReactions = Object.keys(reactions).length > 0;

        return (
            <View style={styles.messageContainer}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => setMenuMsg(item)}
                    onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
                    style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}
                >
                    {/* Avatar for others */}
                    {!isMine && (
                        <TouchableOpacity onPress={() => viewProfile(item.userId)}>
                            {item.user?.photoUrl ? (
                                <Image source={{ uri: item.user.photoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarText}>{item.user?.name?.[0] || '?'}</Text>
                                </View>
                            )}
                            <View style={styles.onlineDot} />
                        </TouchableOpacity>
                    )}

                    <View style={[styles.msgBubble, isMine ? styles.sentBubble : styles.receivedBubble]}>
                        {!isMine && <Text style={styles.senderName}>{item.user?.name || 'User'}</Text>}

                        {/* Reply preview */}
                        {item.replyTo && (
                            <View style={styles.replyPreview}>
                                <Text style={styles.replyName}>↩ {item.replyTo.user?.name || 'User'}</Text>
                                <Text style={styles.replyText} numberOfLines={1}>{item.replyTo.text || '📷 Image'}</Text>
                            </View>
                        )}

                        {/* Images */}
                        {item.images?.length > 0 && (
                            <View style={styles.imageGrid}>
                                {item.images.map((uri, i) => (
                                    <Image key={i} source={{ uri }} style={styles.msgImage} />
                                ))}
                            </View>
                        )}

                        {/* Text */}
                        {item.text && <Text style={styles.msgText}>{item.text}</Text>}
                        
                        <View style={styles.msgFooter}>
                            <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Reactions display */}
                {hasReactions && (
                    <View style={[styles.reactionsRow, isMine && styles.reactionsRowRight]}>
                        {Object.entries(reactions).map(([emoji, users]) => (
                            <TouchableOpacity 
                                key={emoji} 
                                style={[styles.reactionBadge, users.includes(user?.id) && styles.reactionBadgeActive]}
                                onPress={() => reactToMessage(item.id, emoji)}
                            >
                                <Text style={styles.reactionEmoji}>{emoji}</Text>
                                <Text style={styles.reactionCount}>{users.length}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Quick reactions picker */}
                {showReactions === item.id && (
                    <View style={[styles.reactionsPicker, isMine && styles.reactionsPickerRight]}>
                        {REACTIONS.map(emoji => (
                            <TouchableOpacity 
                                key={emoji} 
                                style={styles.reactionOption}
                                onPress={() => reactToMessage(item.id, emoji)}
                            >
                                <Text style={styles.reactionOptionText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                onEndReached={loadOlder}
                onEndReachedThreshold={0.1}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                    if (page === 1) flatListRef.current?.scrollToEnd({ animated: false });
                }}
            />

            {/* Message action menu - Discord style */}
            {menuMsg && (
                <Modal transparent animationType="fade" visible onRequestClose={() => setMenuMsg(null)}>
                    <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuMsg(null)} activeOpacity={1}>
                        <View style={styles.menuBox}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => likeMessage(menuMsg)}>
                                <Text style={styles.menuText}>❤️ Like</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setReplyTo(menuMsg); setMenuMsg(null); }}>
                                <Text style={styles.menuText}>↩️ Reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => shareMessage(menuMsg)}>
                                <Text style={styles.menuText}>📤 Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => viewProfile(menuMsg.userId)}>
                                <Text style={styles.menuText}>👤 View Profile</Text>
                            </TouchableOpacity>
                            {menuMsg.userId !== user?.id && (
                                <TouchableOpacity style={styles.menuItem} onPress={() => reportMessage(menuMsg)}>
                                    <Text style={[styles.menuText, { color: COLORS.accent }]}>🚩 Report</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.menuItem} onPress={() => viewProfile(menuMsg.userId)}>
                                <Text style={styles.menuText}>👤 View Profile</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

            {/* Profile modal */}
            {profileModal && (
                <Modal transparent animationType="slide" visible onRequestClose={() => setProfileModal(null)}>
                    <TouchableOpacity style={styles.menuOverlay} onPress={() => setProfileModal(null)} activeOpacity={1}>
                        <View style={styles.profileBox}>
                            {profileModal.photoUrl ? (
                                <Image source={{ uri: profileModal.photoUrl }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profileImage, styles.avatarPlaceholder]}>
                                    <Text style={{ fontSize: 32, color: '#fff' }}>{profileModal.name?.[0]}</Text>
                                </View>
                            )}
                            <Text style={styles.profileName}>{profileModal.name}</Text>
                            <Text style={styles.profileJoined}>
                                Member since {new Date(profileModal.createdAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
                            </Text>
                            <TouchableOpacity style={styles.profileClose} onPress={() => setProfileModal(null)}>
                                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

            {/* Reply preview bar */}
            {replyTo && (
                <View style={styles.replyBar}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.replyBarName}>↩️ Replying to {replyTo.user?.name}</Text>
                        <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.text || '📷 Image'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                        <Text style={{ color: COLORS.accent, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Image preview */}
            {selectedImages.length > 0 && (
                <View style={styles.imagePreviewRow}>
                    {selectedImages.map((uri, i) => (
                        <View key={i} style={styles.imagePreviewWrap}>
                            <Image source={{ uri }} style={styles.imagePreview} />
                            <TouchableOpacity
                                style={styles.imageRemoveBtn}
                                onPress={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                            >
                                <Text style={styles.imageRemoveText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* Input bar — with voice recording */}
            <View style={styles.inputBar}>
                {isRecording ? (
                    // Recording UI
                    <View style={styles.recordingBar}>
                        <TouchableOpacity style={styles.cancelRecordBtn} onPress={cancelRecording}>
                            <Text style={{ fontSize: 18, color: COLORS.accent }}>✕</Text>
                        </TouchableOpacity>
                        <View style={styles.recordingIndicator}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
                            <Text style={styles.recordingText}>Recording...</Text>
                        </View>
                        <TouchableOpacity style={styles.stopRecordBtn} onPress={stopRecording}>
                            <Text style={{ fontSize: 18, color: '#fff' }}>➤</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    // Normal input UI
                    <>
                        <TouchableOpacity style={styles.attachBtn} onPress={pickImages}>
                            <Text style={{ fontSize: 20 }}>📷</Text>
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="Type a message..."
                            placeholderTextColor={COLORS.textDim}
                            multiline
                            maxLength={1000}
                        />
                        {(text.trim() || selectedImages.length > 0) ? (
                            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending}>
                                {sending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sendText}>➤</Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.voiceBtn} onPress={startRecording}>
                                <Text style={{ fontSize: 20 }}>🎤</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 },

    // Messages
    messageContainer: { marginBottom: 4 },
    msgRow: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-end' },
    msgRowLeft: { justifyContent: 'flex-start' },
    msgRowRight: { justifyContent: 'flex-end' },
    avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
    avatarPlaceholder: { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    onlineDot: { 
        position: 'absolute', bottom: 0, right: 6, width: 12, height: 12, 
        borderRadius: 6, backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.bg 
    },

    msgBubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
    sentBubble: { backgroundColor: COLORS.sent, borderBottomRightRadius: 4 },
    receivedBubble: { backgroundColor: COLORS.received, borderBottomLeftRadius: 4 },
    senderName: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 3 },
    msgText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
    msgFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
    msgTime: { fontSize: 10, color: COLORS.textDim },

    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
    msgImage: { width: 140, height: 100, borderRadius: 10 },

    replyPreview: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
        padding: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    },
    replyName: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
    replyText: { fontSize: 12, color: COLORS.textDim, marginTop: 2 },

    // Reactions
    reactionsRow: { flexDirection: 'row', marginLeft: 44, marginTop: 2, gap: 4 },
    reactionsRowRight: { justifyContent: 'flex-end', marginRight: 8, marginLeft: 0 },
    reactionBadge: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.reaction,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4,
        borderWidth: 1, borderColor: COLORS.border,
    },
    reactionBadgeActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '20' },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: 12, color: COLORS.text, fontWeight: '600' },

    reactionsPicker: { 
        flexDirection: 'row', marginLeft: 44, marginTop: 4, backgroundColor: COLORS.surface,
        borderRadius: 24, padding: 6, gap: 2, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: COLORS.border,
    },
    reactionsPickerRight: { alignSelf: 'flex-end', marginRight: 8, marginLeft: 0 },
    reactionOption: { padding: 6 },
    reactionOptionText: { fontSize: 20 },

    // Input
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8,
    },
    attachBtn: { padding: 8, backgroundColor: COLORS.card, borderRadius: 20 },
    voiceBtn: { padding: 8, backgroundColor: COLORS.card, borderRadius: 20 },
    input: {
        flex: 1, backgroundColor: COLORS.card, borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
        color: COLORS.text, maxHeight: 100,
    },
    sendBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    },
    sendText: { fontSize: 18, color: '#fff' },

    // Voice Recording
    recordingBar: { 
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    cancelRecordBtn: { padding: 10 },
    recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
    recordingTime: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    recordingText: { fontSize: 13, color: COLORS.textMuted },
    stopRecordBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center',
    },

    // Image preview
    imagePreviewRow: {
        flexDirection: 'row', backgroundColor: COLORS.surface,
        paddingHorizontal: 10, paddingVertical: 8, gap: 8,
    },
    imagePreviewWrap: { position: 'relative' },
    imagePreview: { width: 64, height: 64, borderRadius: 10 },
    imageRemoveBtn: {
        position: 'absolute', top: -6, right: -6,
        backgroundColor: COLORS.accent, width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
    },
    imageRemoveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    // Reply bar
    replyBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, paddingHorizontal: 14, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    replyBarName: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
    replyBarText: { fontSize: 12, color: COLORS.textDim, marginTop: 2 },

    // Menu
    menuOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center',
    },
    menuBox: {
        backgroundColor: COLORS.surface, borderRadius: 16,
        width: 260, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
    },
    menuItem: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    menuText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },

    // Profile modal
    profileBox: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        padding: 24, alignItems: 'center', width: 300, borderWidth: 1, borderColor: COLORS.border,
    },
    profileImage: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
    profileName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    profileJoined: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
    profileClose: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: COLORS.primary, borderRadius: 20 },
});
