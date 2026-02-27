import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Image, Modal, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { dmAPI } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DMChatScreen({ route, navigation }) {
    const { user } = useAuth();
    const { chatId, otherUser, source } = route.params || {};
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        if (chatId) {
            loadMessages();
            const interval = setInterval(loadMessages, 4000);
            return () => clearInterval(interval);
        }
    }, [chatId]);

    const loadMessages = async () => {
        try {
            const res = await dmAPI.getMessages(chatId);
            setMessages(res.data.messages || []);
        } catch (err) {
            console.log('DM load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (imageUrls = []) => {
        if (!text.trim() && imageUrls.length === 0) return;
        setSending(true);
        try {
            await dmAPI.sendMessage(chatId, {
                text: text.trim() || null,
                images: imageUrls,
            });
            setText('');
            loadMessages();
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Failed to send';
            if (errMsg.includes('blocked')) {
                Alert.alert('Blocked', errMsg);
            } else {
                Alert.alert('Error', errMsg);
            }
        } finally {
            setSending(false);
        }
    };

    const pickAndSendImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.7,
                selectionLimit: 3,
            });
            if (result.canceled || !result.assets?.length) return;

            setUploading(true);

            const formData = new FormData();
            result.assets.forEach((asset, i) => {
                const ext = asset.uri.split('.').pop() || 'jpg';
                formData.append('images', {
                    uri: asset.uri,
                    type: `image/${ext}`,
                    name: `dm_image_${i}.${ext}`,
                });
            });

            const uploadRes = await dmAPI.uploadImages(chatId, formData);
            const imageUrls = uploadRes.data.images || [];
            if (imageUrls.length > 0) {
                await sendMessage(imageUrls);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to send image');
        } finally {
            setUploading(false);
        }
    };

    const blockUser = () => {
        Alert.alert(
            '🚫 Block User',
            `Block ${otherUser?.name}? You will no longer receive messages from them.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block', style: 'destructive',
                    onPress: async () => {
                        try {
                            await dmAPI.blockUser(chatId);
                            Alert.alert('Blocked', 'User has been blocked.', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                            ]);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to block user.');
                        }
                    },
                },
            ]
        );
    };

    const reportUser = () => {
        Alert.alert(
            '⚠️ Report User',
            `Report ${otherUser?.name} for inappropriate behavior?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report', style: 'destructive',
                    onPress: async () => {
                        try {
                            await dmAPI.report(chatId, { reason: 'Inappropriate/vulgar language' });
                            Alert.alert('Reported ✅', 'User has been reported. Admins will review.');
                        } catch (err) {
                            Alert.alert('Error', 'Failed to report.');
                        }
                    },
                },
            ]
        );
    };

    const showOptions = () => {
        Alert.alert(
            otherUser?.name || 'Options',
            'Choose an action',
            [
                { text: '⚠️ Report User', onPress: reportUser },
                { text: '🚫 Block User', onPress: blockUser, style: 'destructive' },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const renderMessage = ({ item }) => {
        const isMe = item.sender?.id === user?.id;
        const hasImages = item.images && item.images.length > 0;

        return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    {/* Images */}
                    {hasImages && (
                        <View style={styles.imageGrid}>
                            {item.images.map((img, idx) => (
                                <TouchableOpacity key={idx} onPress={() => setPreviewImage(img)}>
                                    <Image
                                        source={{ uri: img }}
                                        style={[
                                            styles.msgImage,
                                            item.images.length === 1 && styles.msgImageSingle,
                                        ]}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {/* Text */}
                    {item.text && (
                        <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.text}</Text>
                    )}
                    <Text style={[styles.time, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                        {new Date(item.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    {otherUser?.photoUrl ? (
                        <Image source={{ uri: otherUser.photoUrl }} style={styles.headerAvatar} />
                    ) : (
                        <View style={styles.headerAvatarFallback}>
                            <Text style={styles.headerAvatarText}>{otherUser?.name?.[0] || '?'}</Text>
                        </View>
                    )}
                    <View>
                        <Text style={styles.headerName}>{otherUser?.name || 'Chat'}</Text>
                        {source === 'RISHTA' && (
                            <Text style={styles.headerSubtitle}>💍 Rishta Chat</Text>
                        )}
                    </View>
                </View>
                <TouchableOpacity onPress={showOptions} style={styles.menuBtn}>
                    <Text style={styles.menuIcon}>⋮</Text>
                </TouchableOpacity>
            </View>

            {/* Respect Banner */}
            <View style={styles.respectBanner}>
                <Text style={styles.respectText}>🤝 Respect is Mandatory — Be kind & respectful</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Text style={{ fontSize: 48, marginBottom: 10 }}>💬</Text>
                            <Text style={styles.emptyChatTitle}>Start a conversation</Text>
                            <Text style={styles.emptyChatSub}>Be respectful and kind. Say Salam! 👋</Text>
                        </View>
                    }
                />
            )}

            {/* Input Bar */}
            <View style={styles.inputBar}>
                <TouchableOpacity
                    style={styles.imageBtn}
                    onPress={pickAndSendImage}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <Text style={styles.imageBtnText}>📷</Text>
                    )}
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    value={text}
                    onChangeText={setText}
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
                    onPress={() => sendMessage([])}
                    disabled={!text.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.sendText}>➤</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Image Preview Modal */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <View style={styles.previewOverlay}>
                    <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)}>
                        <Text style={styles.previewCloseText}>✕</Text>
                    </TouchableOpacity>
                    {previewImage && (
                        <Image
                            source={{ uri: previewImage }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 12,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    backBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -2 },
    headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
    headerAvatarFallback: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center', marginRight: 10,
    },
    headerAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
    menuBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    menuIcon: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    // Respect banner
    respectBanner: {
        backgroundColor: '#FFF8E1', paddingVertical: 6, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#FFE082',
    },
    respectText: { fontSize: 11, color: '#F57F17', textAlign: 'center', fontWeight: '600' },
    // Empty chat
    emptyChat: { alignItems: 'center', paddingVertical: 80 },
    emptyChatTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
    emptyChatSub: { fontSize: 13, color: COLORS.textLight },
    // Messages
    msgRow: { marginBottom: 6 },
    msgRowMe: { alignItems: 'flex-end' },
    bubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingBottom: 4 },
    bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    msgText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
    time: { fontSize: 10, color: COLORS.textLight, textAlign: 'right', marginTop: 4 },
    // Images in messages
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    msgImage: { width: 100, height: 100, borderRadius: 10 },
    msgImageSingle: { width: 200, height: 200 },
    // Input
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 8,
        borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
    },
    imageBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background,
        justifyContent: 'center', alignItems: 'center', marginRight: 6,
    },
    imageBtnText: { fontSize: 20 },
    input: {
        flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 16,
        paddingVertical: 10, fontSize: 14, color: COLORS.text, maxHeight: 80, marginRight: 6,
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    sendText: { color: '#fff', fontSize: 18, marginLeft: 2 },
    // Image preview modal
    previewOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center',
    },
    previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    previewCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    previewImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32 },
});
