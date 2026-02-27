import React, { useState } from 'react';
import {
    View, Modal, StyleSheet, TouchableOpacity, Text,
    Dimensions, FlatList, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import { COLORS } from '../config/constants';

const { width, height } = Dimensions.get('window');

export default function ImageViewer({ images, visible, initialIndex, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);

    if (!visible || !images?.length) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <StatusBar backgroundColor="black" barStyle="light-content" />
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.counter}>
                        {currentIndex + 1} / {images.length}
                    </Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Image Gallery */}
                <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={initialIndex}
                    getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                    onMomentumScrollEnd={(e) => {
                        const index = Math.round(e.nativeEvent.contentOffset.x / width);
                        setCurrentIndex(index);
                    }}
                    keyExtractor={(item, index) => `image-${index}`}
                    renderItem={({ item }) => (
                        <View style={styles.imageContainer}>
                            <ReactNativeZoomableView
                                maxZoom={4}
                                minZoom={1}
                                zoomStep={0.5}
                                initialZoom={1}
                                bindToBorders={true}
                                style={styles.zoomView}
                            >
                                <Image
                                    source={{ uri: item }}
                                    style={styles.image}
                                    contentFit="contain"
                                    transition={200}
                                />
                            </ReactNativeZoomableView>
                        </View>
                    )}
                />

                {/* Dot Indicators */}
                {images.length > 1 && (
                    <View style={styles.dots}>
                        {images.map((_, index) => (
                            <View
                                key={index}
                                style={[styles.dot, currentIndex === index && styles.dotActive]}
                            />
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        color: COLORS.white,
        fontSize: 20,
    },
    counter: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    imageContainer: {
        width,
        height: height - 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomView: {
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        marginHorizontal: 4,
    },
    dotActive: {
        backgroundColor: COLORS.white,
        width: 24,
    },
});
