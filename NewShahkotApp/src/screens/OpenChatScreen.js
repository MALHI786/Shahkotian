import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image,
    KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, Keyboard, Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../services/api';

// WhatsApp-style dark theme
const COLORS = {
    bg: '#0B141A',
    surface: '#1F2C34',
    card: '#2A3942',
    primary: '#00A884',
    primaryDark: '#005C4B',
    text: '#E9EDEF',
    textMuted: '#8696A0',
    textDim: 'rgba(255,255,255,0.4)',
    border: '#2A3942',
    sent: '#005C4B',
    received: '#1F2C34',
    accent: '#EF4444',
    success: '#00A884',
    warning: '#FAA61A',
    reaction: '#2A3942',
    online: '#00A884',
};

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

export default function OpenChatScreen({ navigation }) {
    const { user } = useAuth();
    const [messages, setMessages]             = useState([]);
    const [reactionsMap, setReactionsMap]     = useState({}); // separate state, survives polls
    const [text, setText]                     = useState('');
    const [selectedImages, setSelectedImages] = useState([]);
    const [replyTo, setReplyTo]               = useState(null);
    const [loading, setLoading]               = useState(true);
    const [sending, setSending]               = useState(false);
    const [page, setPage]                     = useState(1);
    const [hasMore, setHasMore]               = useState(true);
    const [profileModal, setProfileModal]     = useState(null);
    const [menuMsg, setMenuMsg]               = useState(null);
    const [showReactions, setShowReactions]   = useState(null);
    const [isRecording, setIsRecording]       = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploadingVoice, setUploadingVoice] = useState(false);
    const [playingId, setPlayingId]           = useState(null);
    const [playPositions, setPlayPositions]   = useState({});
    const flatListRef      = useRef(null);
    const pollRef          = useRef(null);
    const recordingRef     = useRef(null);
    const recordingTimerRef= useRef(null);
    const soundRef         = useRef(null);
    const playingIdRef     = useRef(null);

    // Load messages — smart merge so poll does NOT replace existing messages
    const loadMessages = useCallback(async (pageNum = 1, append = false) => {
        try {
            const res = await chatAPI.getMessages(pageNum);
            const msgs = res.data.messages || [];
            if (append) {
                // Loading older pages: prepend older messages
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const older = msgs.filter(m => !existingIds.has(m.id));
                    return [...older, ...prev];
                });
            } else {
                // Poll / initial: only append truly new messages, keep existing intact
                setMessages(prev => {
                    if (prev.length === 0) return msgs;
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMsgs = msgs.filter(m => !existingIds.has(m.id));
                    if (newMsgs.length === 0) return prev; // no change > no re-render
                    return [...prev, ...newMsgs];
                });
            }
            setHasMore(res.data.pagination?.page < res.data.pagination?.totalPages);
        } catch (err) {
            console.error('Load messages err:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + polling every 10s
    useEffect(() => {
        loadMessages(1);
        pollRef.current = setInterval(() => loadMessages(1), 10000);
        return () => {
            clearInterval(pollRef.current);
            soundRef.current?.unloadAsync().catch(() => {});
        };
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
        if (recordingRef.current) return; // Prevent double recording
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
        const dur = recordingDuration;
        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            if (uri && dur >= 1) sendVoiceMessage(uri, dur);
        } catch (err) {
            console.error('Stop recording error:', err);
        }
        setRecordingDuration(0);
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

    const sendVoiceMessage = async (uri, dur) => {
        setSending(true);
        setUploadingVoice(true);
        try {
            // 1. Read audio file as base64 (avoids FormData issues in React Native)
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // 2. Upload base64 audio to backend > Cloudinary
            const upRes = await chatAPI.uploadVoice({ audioBase64: base64 });
            const voiceUrl = upRes.data.voiceUrl;

            // 3. Send message with voiceUrl + duration
            await chatAPI.sendMessage({
                text: null,
                images: [],
                voiceUrl,
                voiceDuration: dur,
                replyToId: replyTo?.id || null,
            });
            setReplyTo(null);
            await loadMessages(1);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
        } catch (err) {
            console.error('Voice send error:', err);
            Alert.alert('Error', 'Failed to send voice message.');
        } finally {
            setSending(false);
            setUploadingVoice(false);
            setRecordingDuration(0);
        }
    };

    // Voice playback
    const togglePlayVoice = async (msg) => {
        const msgId = msg.id;
        if (!msg.voiceUrl) return;

        // Pause if already playing this message
        if (playingIdRef.current === msgId) {
            try { await soundRef.current?.pauseAsync(); } catch (_) {}
            setPlayingId(null);
            playingIdRef.current = null;
            return;
        }

        // Unload previous sound
        if (soundRef.current) {
            try { await soundRef.current.unloadAsync(); } catch (_) {}
            soundRef.current = null;
        }
        setPlayingId(msgId);
        playingIdRef.current = msgId;

        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
            const { sound } = await Audio.Sound.createAsync(
                { uri: msg.voiceUrl },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        setPlayPositions(prev => ({
                            ...prev,
                            [msgId]: { pos: status.positionMillis || 0, dur: status.durationMillis || 1 },
                        }));
                        if (status.didJustFinish) {
                            setPlayingId(null);
                            playingIdRef.current = null;
                            soundRef.current?.unloadAsync().catch(() => {});
                            soundRef.current = null;
                        }
                    }
                }
            );
            soundRef.current = sound;
        } catch (err) {
            Alert.alert('Error', 'Could not play voice message.');
            setPlayingId(null);
            playingIdRef.current = null;
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

    // React to message — stored in reactionsMap, NOT in messages array, so polls never wipe them
    const reactToMessage = (msgId, emoji) => {
        setReactionsMap(prev => {
            const existing = prev[msgId] || {};
            const users = existing[emoji] || [];
            let updated;
            if (users.includes(user?.id)) {
                const kept = users.filter(id => id !== user?.id);
                updated = { ...existing, [emoji]: kept };
                if (kept.length === 0) delete updated[emoji];
            } else {
                updated = { ...existing, [emoji]: [...users, user?.id] };
            }
            return { ...prev, [msgId]: updated };
        });
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
        return new Date(date).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDuration = (seconds) => {
        const s = Math.round(seconds || 0);
        return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    };

    const renderMessage = ({ item }) => {
        const isMine     = item.userId === user?.id;
        const reactions  = reactionsMap[item.id] || {};   // from separate state, poll-safe
        const hasReactions = Object.keys(reactions).length > 0;
        const isPlaying  = playingId === item.id;
        const voicePos   = playPositions[item.id] || { pos: 0, dur: 1 };
        const voiceProgress = item.voiceUrl ? Math.min(voicePos.pos / (voicePos.dur || 1), 1) : 0;

        return (
            <View style={styles.messageContainer}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => setMenuMsg(item)}
                    onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
                    style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}
                >
                    {/* Avatar for others */}
                    {!isMine && (
                        <TouchableOpacity onPress={() => viewProfile(item.userId)} style={{ marginRight: 6 }}>
                            {item.user?.photoUrl ? (
                                <Image source={{ uri: item.user.photoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarText}>{item.user?.name?.[0] || '?'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    <View style={[styles.msgBubble, isMine ? styles.sentBubble : styles.receivedBubble]}>
                        {!isMine && <Text style={styles.senderName}>{item.user?.name || 'User'}</Text>}

                        {/* Reply preview */}
                        {item.replyTo && (
                            <View style={styles.replyPreview}>
                                <View style={styles.replyAccentBar} />
                                <View>
                                    <Text style={styles.replyName}>{item.replyTo.user?.name || 'User'}</Text>
                                    <Text style={styles.replyText} numberOfLines={1}>
                                        {item.replyTo.voiceUrl ? '🎤 Voice message' : (item.replyTo.text || '📷 Photo')}
                                    </Text>
                                </View>
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

                        {/* Voice message player */}
                        {item.voiceUrl && (
                            <TouchableOpacity
                                style={styles.voicePlayer}
                                onPress={() => togglePlayVoice(item)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.voicePlayBtn, isPlaying && { backgroundColor: COLORS.primary }]}>
                                    <Text style={{ fontSize: 16, color: '#fff' }}>{isPlaying ? '⏸' : '▶'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    {/* Waveform bar */}
                                    <View style={styles.waveformRow}>
                                        {[...Array(18)].map((_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.waveSegment,
                                                    { height: 8 + Math.sin(i * 0.9) * 8 },
                                                    i / 18 < voiceProgress && { backgroundColor: COLORS.primary },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <Text style={styles.voiceDuration}>
                                        {isPlaying ? formatDuration(voicePos.pos / 1000) : formatDuration(item.voiceDuration || 0)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Text */}
                        {item.text && <Text style={styles.msgText}>{item.text}</Text>}

                        <View style={styles.msgFooter}>
                            <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
                            {isMine && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>✓✓</Text>}
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
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                            {menuMsg.userId === user?.id && (
                                <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete', style: 'destructive', onPress: async () => {
                                            try {
                                                await chatAPI.deleteMessage(menuMsg.id);
                                                setMessages(prev => prev.filter(m => m.id !== menuMsg.id));
                                                setMenuMsg(null);
                                            } catch (e) {
                                                Alert.alert('Error', 'Could not delete message');
                                            }
                                        }}
                                    ]);
                                }}>
                                    <Text style={[styles.menuText, { color: '#FF4444' }]}>🗑️ Delete</Text>
                                </TouchableOpacity>
                            )}
                            {menuMsg.userId !== user?.id && (
                                <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => reportMessage(menuMsg)}>
                                    <Text style={[styles.menuText, { color: COLORS.accent }]}>🚩 Report</Text>
                                </TouchableOpacity>
                            )}
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
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
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
    list: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6 },

    // Messages
    messageContainer: { marginBottom: 4 },
    msgRow: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-end' },
    msgRowLeft: { justifyContent: 'flex-start' },
    msgRowRight: { justifyContent: 'flex-end' },
    avatar: { width: 34, height: 34, borderRadius: 17 },
    avatarPlaceholder: { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

    msgBubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    sentBubble: { backgroundColor: COLORS.sent, borderBottomRightRadius: 4 },
    receivedBubble: { backgroundColor: COLORS.received, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
    senderName: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 3 },
    msgText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
    msgFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 2 },
    msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },

    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
    msgImage: { width: 140, height: 110, borderRadius: 10 },

    // Reply inside bubble
    replyPreview: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8, marginBottom: 6, overflow: 'hidden' },
    replyAccentBar: { width: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
    replyName: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
    replyText: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

    // Voice player
    voicePlayer:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 200 },
    voicePlayBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
    waveformRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
    waveSegment:   { width: 3, borderRadius: 2, backgroundColor: COLORS.textMuted },
    voiceDuration: { fontSize: 11, color: COLORS.textMuted },

    // Reactions
    reactionsRow: { flexDirection: 'row', marginLeft: 40, marginTop: 2, gap: 4, flexWrap: 'wrap' },
    reactionsRowRight: { justifyContent: 'flex-end', marginRight: 8, marginLeft: 0 },
    reactionBadge: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.reaction,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 3,
        borderWidth: 1, borderColor: COLORS.border,
    },
    reactionBadgeActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryDark + '80' },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: 12, color: COLORS.text, fontWeight: '600' },

    reactionsPicker: { 
        flexDirection: 'row', marginLeft: 40, marginTop: 4, backgroundColor: COLORS.surface,
        borderRadius: 24, padding: 6, gap: 2, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: COLORS.border,
    },
    reactionsPickerRight: { alignSelf: 'flex-end', marginRight: 8, marginLeft: 0 },
    reactionOption: { padding: 6 },
    reactionOptionText: { fontSize: 20 },

    // Input
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        backgroundColor: '#202C33', paddingHorizontal: 10,
        paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8,
    },
    attachBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
    voiceBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
    input: {
        flex: 1, backgroundColor: COLORS.card, borderRadius: 22,
        paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
        color: COLORS.text, maxHeight: 120,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    },
    sendText: { fontSize: 18, color: '#fff' },

    // Voice Recording
    recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cancelRecordBtn: { padding: 10 },
    recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
    recordingTime: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    recordingText: { fontSize: 13, color: COLORS.textMuted },
    stopRecordBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
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
        flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center', alignItems: 'center',
    },
    menuBox: {
        backgroundColor: COLORS.surface, borderRadius: 16,
        width: 260, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
    },
    menuItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    menuText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },

    // Profile modal
    profileBox: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        padding: 28, alignItems: 'center', width: 300, borderWidth: 1, borderColor: COLORS.border,
    },
    profileImage: { width: 90, height: 90, borderRadius: 45, marginBottom: 14 },
    profileName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    profileJoined: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
    profileClose: {
        marginTop: 22, paddingVertical: 11, paddingHorizontal: 30,
        backgroundColor: COLORS.primary, borderRadius: 22,
    },
});
