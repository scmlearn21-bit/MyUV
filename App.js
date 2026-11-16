import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SKIN_TYPES = [
  { id: 1, short: 'Type I', desc: 'Very Fair', swatch: '#FDE7D6', spf: 'SPF 50+ Broad Spectrum' },
  { id: 2, short: 'Type II', desc: 'Fair', swatch: '#F5CFAF', spf: 'SPF 50+ Broad Spectrum' },
  { id: 3, short: 'Type III', desc: 'Medium', swatch: '#E0AC7E', spf: 'SPF 30–50 Broad Spectrum' },
  { id: 4, short: 'Type IV', desc: 'Olive', swatch: '#B87B4B', spf: 'SPF 30–50 Broad Spectrum' },
  { id: 5, short: 'Type V', desc: 'Brown', swatch: '#824C28', spf: 'SPF 30+ Broad Spectrum' },
  { id: 6, short: 'Type VI', desc: 'Deep', swatch: '#4A2814', spf: 'SPF 30+ Broad Spectrum' },
];

export default function App() {
  const [uvIndex, setUvIndex] = useState(null);
  const [peakUV, setPeakUV] = useState(null);
  const [cityName, setCityName] = useState('Locating...');
  const [loading, setLoading] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState(SKIN_TYPES[1]);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    fetchLocalUV();
  }, []);

  // Live countdown ticker when sunscreen timer is active
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const fetchLocalUV = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCityName('Location Off');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      // Reverse geocode for city name
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places.length > 0) {
        setCityName(places[0].city || places[0].region || 'Local Area');
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=uv_index&daily=uv_index_max&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json();

      setUvIndex(Math.round(data.current.uv_index));
      setPeakUV(Math.round(data.daily.uv_index_max[0]));
    } catch (err) {
      setCityName('Offline');
    } finally {
      setLoading(false);
    }
  };

  const getUVTheme = (uv) => {
    if (uv === null || uv <= 2) {
      return {
        level: 'LOW RISK',
        gradient: ['#059669', '#10B981', '#064E3B'],
        accent: '#34D399',
        advice: 'Minimal UV radiation right now. Sunglasses are plenty for brief errands outside.',
      };
    }
    if (uv <= 5) {
      return {
        level: 'MODERATE',
        gradient: ['#D97706', '#F59E0B', '#78350F'],
        accent: '#FBBF24',
        advice: `Apply ${selectedSkin.spf} before heading out and look for shade around midday.`,
      };
    }
    if (uv <= 7) {
      return {
        level: 'HIGH',
        gradient: ['#EA580C', '#F97316', '#7C2D12'],
        accent: '#FB923C',
        advice: `Strong UV rays. Wear ${selectedSkin.spf}, UV-blocking sunglasses, and a wide-brimmed hat.`,
      };
    }
    return {
      level: 'VERY HIGH',
      gradient: ['#DC2626', '#F43F5E', '#881337'],
      accent: '#FB7185',
      advice: `Intense UV exposure. Apply ${selectedSkin.spf}, wear UPF clothing, and limit direct midday sun.`,
    };
  };

  const scheduleSunscreenReminder = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to Reapply Sunscreen 🧴',
          body: '2 hours are up! Reapply your SPF to stay protected.',
        },
        trigger: { seconds: 7200 },
      });
    }
    setSecondsLeft(7200); // Start 2-hour live UI countdown
  };

  const formatTimer = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const theme = getUVTheme(uvIndex);
  const uvPercent = uvIndex !== null ? Math.min((uvIndex / 11) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Top Navigation Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>MyUV</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color="#94A3B8" />
              <Text style={styles.locationText}>{cityName}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocalUV}>
            <Ionicons name="refresh" size={18} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Hero Ambient Gradient Card */}
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{theme.level}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginVertical: 40 }} />
          ) : (
            <>
              <Text style={styles.heroNumber}>{uvIndex !== null ? uvIndex : '--'}</Text>
              <Text style={styles.heroSub}>Current UV Index</Text>

              {/* UV Scale Progress Bar */}
              <View style={styles.meterContainer}>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${uvPercent}%` }]} />
                </View>
                <View style={styles.meterLabels}>
                  <Text style={styles.meterLabelText}>0 Low</Text>
                  <Text style={styles.meterLabelText}>Peak Today: {peakUV ?? '--'}</Text>
                  <Text style={styles.meterLabelText}>11+ Extreme</Text>
                </View>
              </View>
            </>
          )}
        </LinearGradient>

        {/* Protection Guidance Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark" size={20} color={theme.accent} />
            <Text style={styles.cardTitle}>Smart Protection</Text>
          </View>
          <Text style={styles.adviceText}>{theme.advice}</Text>
          <View style={styles.spfPill}>
            <Text style={styles.spfPillText}>Recommended: {selectedSkin.spf}</Text>
          </View>
        </View>

        {/* Visual Skin Tone Swatches */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="color-palette" size={20} color="#A78BFA" />
            <Text style={styles.cardTitle}>Skin Tone Profile</Text>
          </View>
          <View style={styles.swatchGrid}>
            {SKIN_TYPES.map((type) => {
              const isSelected = selectedSkin.id === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.swatchCard, isSelected && styles.swatchCardActive]}
                  onPress={() => setSelectedSkin(type)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.colorCircle, { backgroundColor: type.swatch }]} />
                  <Text style={styles.swatchShort}>{type.short}</Text>
                  <Text style={styles.swatchDesc}>{type.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Interactive Reapply Timer Button */}
        <TouchableOpacity activeOpacity={0.85} onPress={scheduleSunscreenReminder}>
          <LinearGradient
            colors={secondsLeft > 0 ? ['#059669', '#10B981'] : ['#F97316', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Ionicons
              name={secondsLeft > 0 ? 'time' : 'sunny'}
              size={22}
              color="#FFFFFF"
            />
            <View>
              <Text style={styles.ctaTitle}>
                {secondsLeft > 0 ? 'Protection Active' : 'Start 2-Hour SPF Timer'}
              </Text>
              <Text style={styles.ctaSub}>
                {secondsLeft > 0
                  ? `Reapply in ${formatTimer(secondsLeft)}`
                  : 'Tap when you apply sunscreen'}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161E31',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#24304A',
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  badge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroNumber: {
    fontSize: 84,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 92,
    marginTop: 8,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 20,
  },
  meterContainer: {
    width: '100%',
    gap: 8,
  },
  meterTrack: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  glassCard: {
    backgroundColor: '#131A2A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2A44',
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  adviceText: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  spfPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  spfPillText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  swatchCard: {
    width: '31%',
    backgroundColor: '#0D1320',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    gap: 6,
  },
  swatchCardActive: {
    borderColor: '#A78BFA',
    backgroundColor: '#1B1D36',
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  swatchShort: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  swatchDesc: {
    fontSize: 11,
    color: '#94A3B8',
  },
  ctaButton: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
});
