import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { COLORS, SHAHKOT_CENTER } from '../config/constants';
import { useLanguage } from '../context/LanguageContext';

// Weather condition codes mapping
const getWeatherInfo = (code) => {
  const conditions = {
    0: { icon: '☀️', desc: 'Clear sky' },
    1: { icon: '🌤️', desc: 'Mainly clear' },
    2: { icon: '⛅', desc: 'Partly cloudy' },
    3: { icon: '☁️', desc: 'Overcast' },
    45: { icon: '🌫️', desc: 'Foggy' },
    48: { icon: '🌫️', desc: 'Depositing rime fog' },
    51: { icon: '🌦️', desc: 'Light drizzle' },
    53: { icon: '🌦️', desc: 'Moderate drizzle' },
    55: { icon: '🌧️', desc: 'Dense drizzle' },
    61: { icon: '🌧️', desc: 'Slight rain' },
    63: { icon: '🌧️', desc: 'Moderate rain' },
    65: { icon: '🌧️', desc: 'Heavy rain' },
    71: { icon: '🌨️', desc: 'Slight snow' },
    73: { icon: '🌨️', desc: 'Moderate snow' },
    75: { icon: '❄️', desc: 'Heavy snow' },
    80: { icon: '🌦️', desc: 'Slight showers' },
    81: { icon: '🌧️', desc: 'Moderate showers' },
    82: { icon: '⛈️', desc: 'Violent showers' },
    95: { icon: '⛈️', desc: 'Thunderstorm' },
    96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
    99: { icon: '⛈️', desc: 'Severe thunderstorm' },
  };
  return conditions[code] || { icon: '🌡️', desc: 'Unknown' };
};

const getDayName = (dateStr, index) => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getHourLabel = (timeStr) => {
  const date = new Date(timeStr);
  const now = new Date();
  if (date.getHours() === now.getHours() && date.getDate() === now.getDate()) return 'Now';
  return date.toLocaleTimeString('en-PK', { hour: 'numeric', hour12: true });
};

export default function WeatherScreen({ navigation }) {
  const { t } = useLanguage();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'hourly', 'week'

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      const { latitude, longitude } = SHAHKOT_CENTER;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature,uv_index,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=Asia/Karachi&forecast_days=7`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.reason || 'Failed to fetch weather');
      }

      setWeather(data);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(t('weatherError') || 'Failed to load weather. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getNext24Hours = () => {
    if (!weather?.hourly) return [];
    const now = new Date();
    const hours = [];
    for (let i = 0; i < weather.hourly.time.length && hours.length < 24; i++) {
      const hourDate = new Date(weather.hourly.time[i]);
      if (hourDate >= new Date(now.getTime() - 3600000)) {
        hours.push({
          time: weather.hourly.time[i],
          temp: weather.hourly.temperature_2m[i],
          code: weather.hourly.weather_code[i],
          rain: weather.hourly.precipitation_probability[i],
          wind: weather.hourly.wind_speed_10m[i],
          humidity: weather.hourly.relative_humidity_2m[i],
        });
      }
    }
    return hours;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>{'<'} {t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('shahkotWeather')}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>{t('loadingWeather')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>{'<'} {t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('shahkotWeather')}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchWeather}>
            <Text style={styles.retryText}>{t('retry') || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentWeather = getWeatherInfo(weather?.current?.weather_code);
  const hourlyData = getNext24Hours();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shahkotWeather')}</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchWeather(); }}>
          <Text style={styles.refreshBtn}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWeather(); }} tintColor="#fff" />}
      >
        {/* Location */}
        <View style={styles.locationBar}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>{t('weatherLocation')}</Text>
        </View>

        {/* Current Weather */}
        <View style={styles.currentCard}>
          <Text style={styles.currentIcon}>{currentWeather.icon}</Text>
          <Text style={styles.currentTemp}>{Math.round(weather?.current?.temperature_2m)}°C</Text>
          <Text style={styles.feelsLike}>{t('feelsLike')}{Math.round(weather?.current?.apparent_temperature || weather?.current?.temperature_2m)}°C</Text>
          <Text style={styles.currentDesc}>{currentWeather.desc}</Text>
          
          <View style={styles.currentDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>💧</Text>
              <Text style={styles.detailValue}>{weather?.current?.relative_humidity_2m}%</Text>
              <Text style={styles.detailLabel}>{t('humidity')}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>💨</Text>
              <Text style={styles.detailValue}>{Math.round(weather?.current?.wind_speed_10m)} km/h</Text>
              <Text style={styles.detailLabel}>{t('wind')}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🌡️</Text>
              <Text style={styles.detailValue}>{Math.round(weather?.current?.pressure_msl || 0)} hPa</Text>
              <Text style={styles.detailLabel}>{t('pressure')}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>☀️</Text>
              <Text style={styles.detailValue}>{Math.round(weather?.current?.uv_index || 0)}</Text>
              <Text style={styles.detailLabel}>UV Index</Text>
            </View>
          </View>
        </View>

        {/* Sunrise / Sunset */}
        {weather?.daily?.sunrise && (
          <View style={styles.sunCard}>
            <View style={styles.sunItem}>
              <Text style={styles.sunIcon}>🌅</Text>
              <Text style={styles.sunLabel}>{t('sunrise')}</Text>
              <Text style={styles.sunValue}>
                {new Date(weather.daily.sunrise[0]).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </View>
            <View style={styles.sunDivider} />
            <View style={styles.sunItem}>
              <Text style={styles.sunIcon}>🌇</Text>
              <Text style={styles.sunLabel}>{t('sunset')}</Text>
              <Text style={styles.sunValue}>
                {new Date(weather.daily.sunset[0]).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </View>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          {['today', 'hourly', 'week'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'today' ? "Today's Hours" : tab === 'hourly' ? '24-Hour' : '7-Day'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hourly Forecast (horizontal scroll) */}
        {(activeTab === 'today' || activeTab === 'hourly') && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyScroll}>
              {hourlyData.slice(0, activeTab === 'today' ? 12 : 24).map((hour, idx) => {
                const hw = getWeatherInfo(hour.code);
                return (
                  <View key={idx} style={styles.hourCard}>
                    <Text style={styles.hourTime}>{getHourLabel(hour.time)}</Text>
                    <Text style={styles.hourIcon}>{hw.icon}</Text>
                    <Text style={styles.hourTemp}>{Math.round(hour.temp)}°</Text>
                    <View style={styles.hourRain}>
                      <Text style={styles.hourRainIcon}>💧</Text>
                      <Text style={styles.hourRainText}>{hour.rain}%</Text>
                    </View>
                    <Text style={styles.hourWind}>💨 {Math.round(hour.wind)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 7 Day Forecast */}
        {activeTab === 'week' && (
          <View style={styles.forecastCard}>
            {weather?.daily?.time?.map((date, index) => {
              const dayWeather = getWeatherInfo(weather.daily.weather_code[index]);
              return (
                <View key={date} style={[styles.forecastRow, index < weather.daily.time.length - 1 && styles.forecastRowBorder]}>
                  <Text style={styles.forecastDay}>{getDayName(date, index)}</Text>
                  <Text style={styles.forecastIcon}>{dayWeather.icon}</Text>
                  <View style={styles.forecastRain}>
                    <Text style={styles.forecastRainIcon}>💧</Text>
                    <Text style={styles.forecastRainText}>{weather.daily.precipitation_probability_max[index]}%</Text>
                  </View>
                  <View style={styles.forecastExtra}>
                    <Text style={styles.forecastWindText}>💨 {Math.round(weather.daily.wind_speed_10m_max[index])}</Text>
                  </View>
                  <View style={styles.forecastTemps}>
                    <Text style={styles.forecastHigh}>{Math.round(weather.daily.temperature_2m_max[index])}°</Text>
                    <Text style={styles.forecastLow}>{Math.round(weather.daily.temperature_2m_min[index])}°</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Data Attribution */}
        <Text style={styles.attribution}>
          Weather data by Open-Meteo.com | Updated every 15 min
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E3A5F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  refreshBtn: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  loadingText: { color: COLORS.white, marginTop: 16, fontSize: 16 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { color: COLORS.white, fontSize: 16 },
  retryBtn: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: COLORS.white, fontWeight: '600' },
  content: { flex: 1 },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  locationIcon: { fontSize: 18, marginRight: 6 },
  locationText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  currentCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  currentIcon: { fontSize: 80 },
  currentTemp: { fontSize: 64, fontWeight: '300', color: COLORS.white, marginVertical: 4 },
  feelsLike: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  currentDesc: { fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 20 },
  currentDetails: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  detailItem: { alignItems: 'center', width: 70 },
  detailIcon: { fontSize: 20, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  detailLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  // Sun card
  sunCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
  },
  sunItem: { flex: 1, alignItems: 'center' },
  sunIcon: { fontSize: 28, marginBottom: 4 },
  sunLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  sunValue: { fontSize: 16, fontWeight: '600', color: COLORS.white, marginTop: 4 },
  sunDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },
  // Hourly
  hourlyScroll: { paddingHorizontal: 16, paddingBottom: 8 },
  hourCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    width: 80,
  },
  hourTime: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 6 },
  hourIcon: { fontSize: 28, marginBottom: 6 },
  hourTemp: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  hourRain: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  hourRainIcon: { fontSize: 10 },
  hourRainText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 2 },
  hourWind: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  // Forecast
  forecastCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  forecastRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  forecastDay: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  forecastIcon: { fontSize: 26, marginHorizontal: 8 },
  forecastRain: { flexDirection: 'row', alignItems: 'center', width: 44 },
  forecastRainIcon: { fontSize: 11 },
  forecastRainText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 2 },
  forecastExtra: { width: 45 },
  forecastWindText: { fontSize: 11, color: COLORS.textSecondary },
  forecastTemps: { flexDirection: 'row', alignItems: 'center', width: 65, justifyContent: 'flex-end' },
  forecastHigh: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  forecastLow: { fontSize: 16, color: COLORS.textSecondary, marginLeft: 8 },
  attribution: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
});
