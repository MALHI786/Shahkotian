import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Image,
} from 'react-native';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { dmAPI } from '../services/api';

export default function DMChatScreen({ route, navigation }) {
    const { user } = useAuth();
    const { chatId, otherUser } = route.params || {};
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
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

    const sendMessage = async () => {
        if (!text.trim()) return;
        setSending(true);
        try {
            await dmAPI.sendMessage(chatId, { text: text.trim() });
            setText('');
            loadMessages();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    const reportUser = () => {
        Alert.alert('Report User', `Report ${otherUser?.name} for inappropriate behavior?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Report', style: 'destructive',
                onPress: async () => {
                    try {
                        await dmAPI.report(chatId, { reason: 'Inappropriate/vulgar language' });
                        Alert.alert('Reported', 'User has been reported. Admins will review.');
                    } catch (err) {
                        Alert.alert('Error', 'Failed to report.');
                    }
                },
            },
        ]);
    };

    const renderMessage = ({ item }) => {
        const isMe = item.sender?.id === user?.id;
        return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.text}</Text>
                    <Text style={[styles.time, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                        {new Date(item.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtn}>{'<'} Back</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    {otherUser?.photoUrl ? (
                        <Image source={{ uri: otherUser.photoUrl }} style={styles.headerAvatar} />
                    ) : (
                        <View style={styles.headerAvatarFallback}>
                            <Text style={styles.headerAvatarText}>{otherUser?.name?.[0] || '?'}</Text>
                        </View>
                    )}
                    <Text style={styles.headerName}>{otherUser?.name || 'Chat'}</Text>
                </View>
                <TouchableOpacity onPress={reportUser}>
                    <Text style={styles.reportBtn}>⚠️</Text>
                </TouchableOpacity>
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
                            <Text style={{ fontSize: 40, marginBottom: 10 }}>💬</Text>
                            <Text style={{ color: COLORS.textLight }}>Send a message to start chatting</Text>
                        </View>
                    }
                />
            )}

            <View style={styles.inputBar}>
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
                    onPress={sendMessage}
                    disabled={!text.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.sendText}>Send</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    },
    backBtn: { color: COLORS.white, fontSize: 16 },
    headerInfo: { flexDirection: 'row', alignItems: 'center' },
    headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
    headerAvatarFallback: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center', marginRight: 8,
    },
    headerAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    headerName: { fontSize: 17, fontWeight: '700', color: COLORS.white },
    reportBtn: { fontSize: 22, padding: 4 },
    emptyChat: { alignItems: 'center', paddingVertical: 80 },
    msgRow: { marginBottom: 6 },
    msgRowMe: { alignItems: 'flex-end' },
    bubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingBottom: 4 },
    bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
    msgText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
    time: { fontSize: 10, color: COLORS.textLight, textAlign: 'right', marginTop: 4 },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 10,
        borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
    },
    input: {
        flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 16,
        paddingVertical: 10, fontSize: 14, color: COLORS.text, maxHeight: 80, marginRight: 8,
    },
    sendBtn: {
        backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    },
    sendText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
});
