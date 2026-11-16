import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SKIN_TYPES = [
  { id: 1, label: 'Type I (Very Fair)', spf: 'SPF 50+ Broad Spectrum' },
  { id: 2, label: 'Type II (Fair)', spf: 'SPF 50+ Broad Spectrum' },
  { id: 3, label: 'Type III (Medium)', spf: 'SPF 30–50 Broad Spectrum' },
  { id: 4, label: 'Type IV (Olive)', spf: 'SPF 30–50 Broad Spectrum' },
  { id: 5, label: 'Type V (Brown)', spf: 'SPF 30+ Broad Spectrum' },
  { id: 6, label: 'Type VI (Dark Brown/Black)', spf: 'SPF 30+ Broad Spectrum' },
];

export default function App() {
  const [uvIndex, setUvIndex] = useState(null);
  const [peakUV, setPeakUV] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkin, setSelectedSkin] = useState(SKIN_TYPES[1]);
  const [reminderSet, setReminderSet] = useState(false);

  useEffect(() => {
    fetchLocalUV();
  }, []);

  const fetchLocalUV = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Enable location access to check local UV levels.');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      // Free Open-Meteo UV Forecast API (no key required)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=uv_index&daily=uv_index_max&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json();

      setUvIndex(Math.round(data.current.uv_index));
      setPeakUV(Math.round(data.daily.uv_index_max[0]));
    } catch (err) {
      Alert.alert('Error', 'Could not load local UV data.');
    } finally {
      setLoading(false);
    }
  };

  const getUVStatus = (uv) => {
    if (uv <= 2) return { level: 'Low', color: '#22c55e', advice: 'Low UV. Sunglasses recommended for bright glare; minimal burn risk.' };
    if (uv <= 5) return { level: 'Moderate', color: '#eab308', advice: `Moderate UV. Apply ${selectedSkin.spf} and seek shade near midday.` };
    if (uv <= 7) return { level: 'High', color: '#f97316', advice: `High UV. Apply ${selectedSkin.spf}, wear a wide-brimmed hat and UV-blocking sunglasses.` };
    return { level: 'Very High / Extreme', color: '#ef4444', advice: `Very High UV. Wear ${selectedSkin.spf}, UPF clothing, and limit direct midday sun.` };
  };

  const scheduleSunscreenReminder = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Notifications Disabled', 'Enable notifications to receive sunscreen reminders.');
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to Reapply Sunscreen 🧴',
        body: 'It has been 2 hours since your last application. Reapply SPF to stay protected.',
      },
      trigger: { seconds: 7200 }, // 2 hours
    });

    setReminderSet(true);
    Alert.alert('Reminder Set', 'MyUV will remind you to reapply sunscreen in 2 hours.');
  };

  const statusInfo = uvIndex !== null ? getUVStatus(uvIndex) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>MyUV</Text>

        {/* Live UV Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT UV INDEX</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#f97316" style={{ marginVertical: 24 }} />
          ) : uvIndex !== null ? (
            <>
              <Text style={[styles.uvNumber, { color: statusInfo.color }]}>{uvIndex}</Text>
              <Text style={styles.uvLevel}>{statusInfo.level}</Text>
              <Text style={styles.peakText}>Today's Peak UV: {peakUV}</Text>
            </>
          ) : (
            <Text style={styles.peakText}>Location unavailable</Text>
          )}
        </View>

        {/* Skin Type Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Skin Profile</Text>
          <View style={styles.chipGrid}>
            {SKIN_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.chip, selectedSkin.id === type.id && styles.chipActive]}
                onPress={() => setSelectedSkin(type)}
              >
                <Text style={[styles.chipText, selectedSkin.id === type.id && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Protection Guidance */}
        {statusInfo && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sun Protection Guidance</Text>
            <Text style={styles.adviceText}>{statusInfo.advice}</Text>
          </View>
        )}

        {/* Reapply Button */}
        <TouchableOpacity
          style={[styles.button, reminderSet && styles.buttonSuccess]}
          onPress={scheduleSunscreenReminder}
        >
          <Text style={styles.buttonText}>
            {reminderSet ? '✓ Reminder Set (2 Hours)' : 'I Just Applied Sunscreen'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, gap: 16 },
  header: { fontSize: 34, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textAlign: 'center', letterSpacing: 1 },
  uvNumber: { fontSize: 72, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  uvLevel: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#0f172a' },
  peakText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  chipGrid: { gap: 8 },
  chip: { padding: 12, borderRadius: 12, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#0f172a' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#ffffff' },
  adviceText: { fontSize: 15, color: '#475569', lineHeight: 22 },
  button: { backgroundColor: '#f97316', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  buttonSuccess: { backgroundColor: '#22c55e' },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
});
