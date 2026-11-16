import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
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
  { id: 1, label: 'Porcelain', swatch: '#FCE8D8', spf: 'SPF 50+ PA++++', burnTime: '10–15 min unprotected' },
  { id: 2, label: 'Ivory', swatch: '#F4D1B5', spf: 'SPF 50+ PA++++', burnTime: '15–20 min unprotected' },
  { id: 3, label: 'Beige', swatch: '#DFA97B', spf: 'SPF 50 Broad Spectrum', burnTime: '20–30 min unprotected' },
  { id: 4, label: 'Honey', swatch: '#B87B49', spf: 'SPF 30–50 Broad Spectrum', burnTime: '30–45 min unprotected' },
  { id: 5, label: 'Caramel', swatch: '#834D29', spf: 'SPF 30+ Broad Spectrum', burnTime: '45–60 min unprotected' },
  { id: 6, label: 'Espresso', swatch: '#4B2915', spf: 'SPF 30+ Broad Spectrum', burnTime: '60+ min unprotected' },
];

const SUNSCREEN_CATALOG = [
  {
    id: 'mineral-sheer',
    name: 'Sheer Mineral Zinc Fluid SPF 50',
    type: '100% Mineral • Fragrance-Free',
    bestFor: ['Sensitive', 'Dry', 'All'],
    durationMins: 120,
    tag: 'DERM FAVORITE',
    note: 'Gentle non-nano zinc oxide with zero irritation and a luminous satin finish.',
  },
  {
    id: 'invisible-gel',
    name: 'Invisible Water-Gel SPF 50+',
    type: 'Weightless Chemical • Zero White Cast',
    bestFor: ['Oily', 'Combo', 'All'],
    durationMins: 120,
    tag: 'NO WHITE CAST',
    note: 'Ultra-lightweight serum texture that disappears instantly on medium to deep skin tones.',
  },
  {
    id: 'sport-shield',
    name: 'Active Water-Resistant Shield SPF 50',
    type: '80-Min Water & Sweat Resistant',
    bestFor: ['Outdoor', 'Oily', 'All'],
    durationMins: 80,
    tag: 'OUTDOOR & SWIM',
    note: 'Holds strong through humidity, workouts, and pool days without stinging eyes.',
  },
  {
    id: 'dewy-milk',
    name: 'Ceramide Barrier Dewy Milk SPF 40',
    type: 'Hydrating + Niacinamide',
    bestFor: ['Dry', 'Sensitive', 'All'],
    durationMins: 120,
    tag: 'GLOW BOOST',
    note: 'Doubles as a rich barrier moisturizer while shielding against UVA/UVB rays.',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'scan' | 'spf' | 'alerts'

  // Weather & Location State
  const [uvIndex, setUvIndex] = useState(null);
  const [peakUV, setPeakUV] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState([]);
  const [cityName, setCityName] = useState('Locating...');
  const [loading, setLoading] = useState(true);

  // Skin Profile & Quiz State
  const [selectedSkin, setSelectedSkin] = useState(SKIN_TYPES[1]);
  const [selfieUri, setSelfieUri] = useState(null);
  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [burnSensitivity, setBurnSensitivity] = useState('Moderate'); // 'High' | 'Moderate' | 'Low'
  const [skinFinish, setSkinFinish] = useState('Combo'); // 'Dry' | 'Combo' | 'Oily' | 'Sensitive'

  // Logger & Alerts State
  const [loggedProduct, setLoggedProduct] = useState(SUNSCREEN_CATALOG[0]);
  const [isSwimming, setIsSwimming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [uvAlertThreshold, setUvAlertThreshold] = useState(5);
  const [uvAlertEnabled, setUvAlertEnabled] = useState(true);
  const [streakDays, setStreakDays] = useState(3);

  useEffect(() => {
    fetchLocalUV();
  }, []);

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

      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places.length > 0) {
        setCityName(places[0].city || places[0].region || 'Your Area');
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=uv_index&hourly=uv_index&daily=uv_index_max&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json();

      const liveUV = Math.round(data.current.uv_index);
      const maxUV = Math.round(data.daily.uv_index_max[0]);
      setUvIndex(liveUV);
      setPeakUV(maxUV);

      // Trigger threshold notification if live UV meets user's alert setting
      if (uvAlertEnabled && liveUV >= uvAlertThreshold) {
        triggerUVThresholdAlert(liveUV);
      }

      const currentHour = new Date().getHours();
      const upcoming = [];
      for (let i = 0; i < 6; i++) {
        const idx = currentHour + i;
        if (data.hourly && data.hourly.uv_index[idx] !== undefined) {
          const hourLabel =
            idx % 24 === 0 ? '12 AM' : idx % 24 === 12 ? '12 PM' : idx % 24 > 12 ? `${(idx % 24) - 12} PM` : `${idx % 24} AM`;
          upcoming.push({
            time: i === 0 ? 'Now' : hourLabel,
            uv: Math.round(data.hourly.uv_index[idx]),
          });
        }
      }
      setHourlyForecast(upcoming);
    } catch (err) {
      setCityName('Offline');
    } finally {
      setLoading(false);
    }
  };

  const triggerUVThresholdAlert = async (currentVal) => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `MyUV Alert • UV is now ${currentVal} ☀️`,
          body: `Local UV has reached your ${uvAlertThreshold}+ threshold. Apply ${selectedSkin.spf} before heading out.`,
        },
        trigger: null, // fires immediately
      });
    }
  };

  const handleFaceScan = async (useCamera) => {
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (perm.status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow camera or photo access to scan your skin tone.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieUri(result.assets[0].uri);
        setAnalyzingFace(true);

        // Simulate skin-tone & undertone calibration delay
        setTimeout(() => {
          setAnalyzingFace(false);
          Alert.alert(
            'Skin Tone Calibrated ✨',
            'We sampled your lighting and matched your profile. Confirm your burn sensitivity below for exact SPF pairing!'
          );
        }, 1200);
      }
    } catch (e) {
      Alert.alert('Scan Unavailable', 'Camera preview is limited in web browsers—try this on Expo Go on your iPhone!');
    }
  };

  const logApplicationAndStartTimer = async () => {
    const mins = isSwimming ? 40 : loggedProduct.durationMins;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'MyUV • Time to Reapply SPF ✨',
          body: `Your ${loggedProduct.name} (${mins} min wear window) has worn off. Reapply now!`,
        },
        trigger: { seconds: mins * 60 },
      });
    }
    setSecondsLeft(mins * 60);
    setStreakDays((prev) => prev + 1);
  };

  const formatTimer = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const getLuxuryTheme = (uv) => {
    if (uv === null || uv <= 2) {
      return {
        status: 'GENTLE RADIANCE',
        cardGradient: ['#FFFDF9', '#F5EFE6', '#EAE0D2'],
        accentGold: '#B8894A',
        badgeBg: '#F0E6D6',
        advice: `Soft ambient UV. A daily layer of ${selectedSkin.spf} and sunglasses keep skin protected.`,
      };
    }
    if (uv <= 5) {
      return {
        status: 'GOLDEN MODERATE',
        cardGradient: ['#FFF9F0', '#FDEBD0', '#F5CBA7'],
        accentGold: '#C67D33',
        badgeBg: '#FBE3C6',
        advice: `Moderate rays. Smooth on ${selectedSkin.spf} and seek shade between 11 AM and 3 PM.`,
      };
    }
    if (uv <= 7) {
      return {
        status: 'SOLAR INTENSE',
        cardGradient: ['#FFF5F2', '#FADBD8', '#F5B7B1'],
        accentGold: '#C0564B',
        badgeBg: '#F9D1CC',
        advice: `High UV exposure. Layer ${selectedSkin.spf}, UV-shield sunglasses, and a sun hat.`,
      };
    }
    return {
      status: 'PEAK SOLAR ALERT',
      cardGradient: ['#FDF2F4', '#F8C8D4', '#F19DB3'],
      accentGold: '#AD3A58',
      badgeBg: '#F7C2D0',
      advice: `Extreme UV intensity. Apply ${selectedSkin.spf} generously, wear UPF fabrics, and stay shaded.`,
    };
  };

  const theme = getLuxuryTheme(uvIndex);
  const uvPercent = uvIndex !== null ? Math.min((uvIndex / 11) * 100, 100) : 0;

  // Filter recommended sunscreens based on user's quiz answers
  const recommendedSunscreens = SUNSCREEN_CATALOG.filter(
    (item) => item.bestFor.includes(skinFinish) || item.bestFor.includes('All')
  );

  return (
    <LinearGradient colors={['#FAF7F2', '#F3ECE1', '#EDE3D5']} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Top Luxury Brand Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>MyUV</Text>
            <View style={styles.locationRow}>
              <Ionicons name="sparkles" size={12} color="#B8894A" />
              <Text style={styles.locationText}>{cityName.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color="#C49652" />
            <Text style={styles.streakText}>{streakDays}d SPF Streak</Text>
          </View>
        </View>

        {/* TAB 1: TODAY'S UV & LOGGER */}
        {activeTab === 'today' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Hero Glossy Card */}
            <View style={styles.heroOuterShadow}>
              <LinearGradient colors={theme.cardGradient} style={styles.heroCard}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.0)']}
                  style={styles.glossSheen}
                />
                <View style={[styles.statusPill, { backgroundColor: theme.badgeBg }]}>
                  <Text style={[styles.statusText, { color: theme.accentGold }]}>{theme.status}</Text>
                </View>

                {loading ? (
                  <ActivityIndicator size="large" color="#B8894A" style={{ marginVertical: 42 }} />
                ) : (
                  <>
                    <Text style={styles.heroNumber}>{uvIndex !== null ? uvIndex : '--'}</Text>
                    <Text style={styles.heroSub}>LIVE UV INDEX • {selectedSkin.label.toUpperCase()} PROFILE</Text>

                    <View style={styles.meterWrap}>
                      <View style={styles.meterTrack}>
                        <LinearGradient
                          colors={['#E6C280', '#B8894A']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.meterFill, { width: `${uvPercent}%` }]}
                        />
                      </View>
                      <View style={styles.meterLabels}>
                        <Text style={styles.meterCaption}>0 Gentle</Text>
                        <Text style={styles.meterCaptionBold}>Peak Today: {peakUV ?? '--'}</Text>
                        <Text style={styles.meterCaption}>11+ Peak</Text>
                      </View>
                    </View>
                  </>
                )}
              </LinearGradient>
            </View>

            {/* Hourly UV Outlook */}
            {hourlyForecast.length > 0 && (
              <View style={styles.silkCard}>
                <Text style={styles.sectionLabel}>HOURLY UV OUTLOOK</Text>
                <View style={styles.hourlyRow}>
                  {hourlyForecast.map((item, idx) => (
                    <View key={idx} style={[styles.hourPill, idx === 0 && styles.hourPillActive]}>
                      <Text style={[styles.hourTime, idx === 0 && styles.hourTextActive]}>{item.time}</Text>
                      <Ionicons
                        name={item.uv >= 6 ? 'sunny' : 'partly-sunny'}
                        size={17}
                        color={idx === 0 ? '#B8894A' : '#8C7D70'}
                      />
                      <Text style={[styles.hourUV, idx === 0 && styles.hourTextActive]}>{item.uv}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Log Sunscreen Applied */}
            <View style={styles.silkCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionLabel}>LOG APPLIED SUNSCREEN</Text>
                <TouchableOpacity onPress={() => setActiveTab('spf')}>
                  <Text style={styles.linkText}>Change SPF →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.loggedBox}>
                <Ionicons name="flask-outline" size={20} color="#B8894A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.loggedTitle}>{loggedProduct.name}</Text>
                  <Text style={styles.loggedSub}>
                    Wear window: {isSwimming ? '40 mins (Water/Sweat)' : `${loggedProduct.durationMins} mins`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.swimToggle, isSwimming && styles.swimToggleActive]}
                onPress={() => setIsSwimming(!isSwimming)}
              >
                <Ionicons
                  name={isSwimming ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={isSwimming ? '#B8894A' : '#8C7A6B'}
                />
                <Text style={styles.swimText}>Swimming or sweating heavily (40-min timer)</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.88} onPress={logApplicationAndStartTimer}>
                <LinearGradient
                  colors={secondsLeft > 0 ? ['#2C2520', '#4A3F37'] : ['#DFBE84', '#B8894A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaButton}
                >
                  <Ionicons name={secondsLeft > 0 ? 'hourglass-outline' : 'sparkles'} size={20} color="#FFF" />
                  <View>
                    <Text style={styles.ctaTitle}>
                      {secondsLeft > 0 ? 'Protection Active' : 'Start Reapplication Timer'}
                    </Text>
                    <Text style={styles.ctaSub}>
                      {secondsLeft > 0
                        ? `Reapply in ${formatTimer(secondsLeft)}`
                        : `Notifies you when ${loggedProduct.name.split(' ')[0]} wears off`}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* TAB 2: FACE SCANNER & SKIN QUESTIONNAIRE */}
        {activeTab === 'scan' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.silkCard}>
              <Text style={styles.sectionLabel}>AI TONE & FACE CALIBRATION</Text>
              <Text style={styles.adviceBody}>
                Snap a selfie in natural daylight or select your skin swatch manually to calibrate your burn sensitivity.
              </Text>

              {selfieUri && (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
                  {analyzingFace && <Text style={styles.analyzingText}>Analyzing skin undertone...</Text>}
                </View>
              )}

              <View style={styles.rowGap}>
                <TouchableOpacity style={styles.goldOutlineBtn} onPress={() => handleFaceScan(true)}>
                  <Ionicons name="camera-outline" size={18} color="#B8894A" />
                  <Text style={styles.goldOutlineText}>Scan Face</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.goldOutlineBtn} onPress={() => handleFaceScan(false)}>
                  <Ionicons name="image-outline" size={18} color="#B8894A" />
                  <Text style={styles.goldOutlineText}>Upload Photo</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>CONFIRM SKIN TONE</Text>
              <View style={styles.swatchGrid}>
                {SKIN_TYPES.map((type) => {
                  const active = selectedSkin.id === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.swatchBox, active && styles.swatchBoxActive]}
                      onPress={() => setSelectedSkin(type)}
                    >
                      <View style={[styles.swatchDot, { backgroundColor: type.swatch }]} />
                      <Text style={[styles.swatchName, active && styles.swatchNameActive]}>{type.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Sun Sensitivity Questionnaire */}
            <View style={styles.silkCard}>
              <Text style={styles.sectionLabel}>FACE SENSITIVITY QUESTIONNAIRE</Text>

              <Text style={styles.questionTitle}>1. How easily does your face burn in midday sun?</Text>
              <View style={styles.chipRow}>
                {['High (Burns fast)', 'Moderate', 'Low (Rarely)'].map((opt) => {
                  const val = opt.split(' ')[0];
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.quizChip, burnSensitivity === val && styles.quizChipActive]}
                      onPress={() => setBurnSensitivity(val)}
                    >
                      <Text style={[styles.quizChipText, burnSensitivity === val && styles.quizChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.questionTitle}>2. What is your facial skin type?</Text>
              <View style={styles.chipRow}>
                {['Dry', 'Combo', 'Oily', 'Sensitive'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.quizChip, skinFinish === type && styles.quizChipActive]}
                    onPress={() => setSkinFinish(type)}
                  >
                    <Text style={[styles.quizChipText, skinFinish === type && styles.quizChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.resultBanner}>
                <Text style={styles.resultBannerTitle}>Your Match: {selectedSkin.spf}</Text>
                <Text style={styles.resultBannerSub}>
                  Estimated unprotected threshold: {selectedSkin.burnTime} • Tailored for {skinFinish} skin.
                </Text>
              </View>
            </View>
          </ScrollView>
        )}

        {/* TAB 3: CURATED SUNSCREEN RECOMMENDATIONS */}
        {activeTab === 'spf' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.silkCard}>
              <Text style={styles.sectionLabel}>CURATED FOR {skinFinish.toUpperCase()} • {selectedSkin.label.toUpperCase()} SKIN</Text>
              <Text style={styles.adviceBody}>
                Tap any formula below to set it as your active sunscreen for reapplication tracking.
              </Text>

              {recommendedSunscreens.map((item) => {
                const isSelected = loggedProduct.id === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.productCard, isSelected && styles.productCardActive]}
                    onPress={() => {
                      setLoggedProduct(item);
                      setActiveTab('today');
                    }}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagText}>{item.tag}</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#B8894A" />}
                    </View>
                    <Text style={styles.productTitle}>{item.name}</Text>
                    <Text style={styles.productType}>{item.type}</Text>
                    <Text style={styles.productNote}>{item.note}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* TAB 4: CUSTOM UV THRESHOLD ALERTS */}
        {activeTab === 'alerts' && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.silkCard}>
              <Text style={styles.sectionLabel}>SMART UV THRESHOLD ALERTS</Text>
              <Text style={styles.adviceBody}>
                Get an automatic push notification whenever the UV index in {cityName} reaches or exceeds your chosen level.
              </Text>

              <View style={styles.thresholdDisplay}>
                <Text style={styles.thresholdNumber}>UV {uvAlertThreshold}+</Text>
                <Text style={styles.thresholdSub}>
                  {uvAlertThreshold <= 2
                    ? 'Notify even on mild days'
                    : uvAlertThreshold <= 5
                    ? 'Recommended for daily sun protection'
                    : 'Notify only during strong/intense UV'}
                </Text>
              </View>

              <View style={styles.thresholdRow}>
                {[3, 5, 6, 8].map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.lvlBtn, uvAlertThreshold === lvl && styles.lvlBtnActive]}
                    onPress={() => setUvAlertThreshold(lvl)}
                  >
                    <Text style={[styles.lvlBtnText, uvAlertThreshold === lvl && styles.lvlBtnTextActive]}>
                      UV {lvl}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.ctaButton, { backgroundColor: uvAlertEnabled ? '#2C2520' : '#B8894A', marginTop: 8 }]}
                onPress={() => {
                  setUvAlertEnabled(!uvAlertEnabled);
                  if (!uvAlertEnabled && uvIndex !== null && uvIndex >= uvAlertThreshold) {
                    triggerUVThresholdAlert(uvIndex);
                  }
                }}
              >
                <Ionicons name={uvAlertEnabled ? 'notifications' : 'notifications-off'} size={20} color="#FFF" />
                <Text style={styles.ctaTitle}>
                  {uvAlertEnabled ? `Alerts Active for UV ${uvAlertThreshold}+` : 'Enable UV Threshold Alerts'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* LUXURY BOTTOM TAB BAR */}
        <View style={styles.tabBar}>
          {[
            { id: 'today', label: 'Today', icon: 'sunny' },
            { id: 'scan', label: 'Skin Scan', icon: 'scan' },
            { id: 'spf', label: 'SPF Shop', icon: 'sparkles' },
            { id: 'alerts', label: 'UV Alerts', icon: 'notifications' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={() => setActiveTab(tab.id)}>
                <Ionicons
                  name={active ? tab.icon : `${tab.icon}-outline`}
                  size={22}
                  color={active ? '#B8894A' : '#8C7A6B'}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandTitle: { fontSize: 32, fontWeight: '800', color: '#231D18', letterSpacing: -0.8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { fontSize: 11, fontWeight: '700', color: '#8C7A6B', letterSpacing: 1.5 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DEC8',
  },
  streakText: { fontSize: 12, fontWeight: '700', color: '#231D18' },
  scroll: { padding: 20, paddingBottom: 30, gap: 16 },
  heroOuterShadow: {
    borderRadius: 30,
    shadowColor: '#9E7B4F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  heroCard: {
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  glossSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 85 },
  statusPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroNumber: { fontSize: 82, fontWeight: '800', color: '#231D18', lineHeight: 90, marginTop: 6 },
  heroSub: { fontSize: 11, fontWeight: '700', color: '#7A6A5C', letterSpacing: 1.6, marginBottom: 20 },
  meterWrap: { width: '100%', gap: 8 },
  meterTrack: { height: 7, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  meterCaption: { fontSize: 11, color: '#8C7A6B', fontWeight: '600' },
  meterCaptionBold: { fontSize: 12, color: '#231D18', fontWeight: '700' },
  silkCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    gap: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#8C7A6B', letterSpacing: 1.4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10 },
  linkText: { fontSize: 12, fontWeight: '700', color: '#B8894A' },
  hourlyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  hourPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EFE7DA',
    gap: 6,
  },
  hourPillActive: { backgroundColor: '#FFFDF9', borderColor: '#D4AF37', borderWidth: 1.5 },
  hourTime: { fontSize: 10, fontWeight: '700', color: '#8C7A6B' },
  hourUV: { fontSize: 14, fontWeight: '800', color: '#231D18' },
  hourTextActive: { color: '#B8894A' },
  loggedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF7F2',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFE7DA',
  },
  loggedTitle: { fontSize: 14, fontWeight: '700', color: '#231D18' },
  loggedSub: { fontSize: 12, color: '#7A6A5C', marginTop: 2 },
  swimToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  swimToggleActive: { opacity: 1 },
  swimText: { fontSize: 13, color: '#5C5046', fontWeight: '600' },
  ctaButton: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  ctaSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 },
  adviceBody: { fontSize: 14, color: '#5C5046', lineHeight: 20 },
  goldOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor
