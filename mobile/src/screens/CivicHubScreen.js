import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import {
  Siren,
  Bot,
  Compass,
  MapPin,
  Mic,
  Send,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import {
  reverseGeocodePoint,
  getNearbyComplaints,
  estimateRoute,
  processVoiceCommand,
  askCivicAssistant,
  createSosAlert,
  trackSosAlert,
  cancelSosAlert,
} from '../services/advancedService';

const EMERGENCY_TYPES = [
  'Public Safety Hazard',
  'Road Accident',
  'Electrical Hazard',
  'Fire Hazard',
  'Flood / Disaster',
  'Medical Emergency',
  'Women Safety',
];

const VOICE_PRESETS = [
  {
    label: 'Tamil Road Hazard',
    text: 'எங்கள் பகுதியில் பெரிய சாலை குழி மற்றும் தண்ணீர் கசிவு உள்ளது உடனடியாக சரி செய்யவும்',
    lang: 'ta-IN',
  },
  {
    label: 'Tamil Drainage Block',
    text: 'சாக்கடை அடைப்பு ஏற்பட்டு கழிவுநீர் சாலையில் தேங்கியுள்ளது',
    lang: 'ta-IN',
  },
  {
    label: 'English Streetlight',
    text: 'Streetlight electric pole sparking near Karur bus stand main road',
    lang: 'en-IN',
  },
];

export const CivicHubScreen = ({ navigation }) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('sos'); // 'sos' | 'assistant' | 'gis'

  // Shared GPS State
  const [coords, setCoords] = useState({
    latitude: 11.1085,
    longitude: 77.3411,
    accuracy: 14,
  });
  const [geoInfo, setGeoInfo] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // SOS State
  const [emergencyType, setEmergencyType] = useState('Public Safety Hazard');
  const [sosDesc, setSosDesc] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [sosConfirmed, setSosConfirmed] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [activeSos, setActiveSos] = useState(null);
  const [sosTrackInput, setSosTrackInput] = useState('');

  // Voice & AI Assistant State
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        language === 'ta'
          ? 'வணக்கம்! நான் CivicPulse AI உதவியாளர். தமிழ் அல்லது ஆங்கிலத்தில் புகார் அளிக்க, நிலையை அறிய அல்லது அருகிலுள்ள சிக்கல்களைக் காண என்னிடம் கேளுங்கள்.'
          : 'Vanakkam! I am the CivicPulse AI Civic Assistant. Ask me in Tamil or English to draft a complaint, check a tracking ID, or inspect nearby issues.',
      source: 'system',
    },
  ]);

  // Live GIS State
  const [radiusM, setRadiusM] = useState(1000);
  const [nearbyData, setNearbyData] = useState({ count: 0, items: [] });
  const [gisLoading, setGisLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const loadGisContext = useCallback(
    async (lat, lng, rad) => {
      setGisLoading(true);
      try {
        const [geo, near] = await Promise.all([
          reverseGeocodePoint(lat, lng),
          getNearbyComplaints({ latitude: lat, longitude: lng, radius_m: rad, limit: 30 }),
        ]);
        setGeoInfo(geo);
        setNearbyData(near || { count: 0, items: [] });
      } catch (err) {
        console.warn('GIS fetch error:', err?.message);
      } finally {
        setGisLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadGisContext(coords.latitude, coords.longitude, radiusM);
  }, [coords.latitude, coords.longitude, radiusM, loadGisContext]);

  const acquireDeviceGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is required for live GPS coordinates. Using default Tamil Nadu municipal coordinates.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy || 12),
      });
    } catch (err) {
      Alert.alert('GPS Notice', 'Could not lock device GPS. Using last verified coordinates.');
    } finally {
      setGpsLoading(false);
    }
  };

  // SOS Handlers
  const handleSendSos = async () => {
    if (!sosConfirmed) {
      Alert.alert(
        'Confirmation Required',
        'Please tap the confirmation toggle to verify this is a genuine emergency before dispatching an SOS alert.'
      );
      return;
    }
    setSosSubmitting(true);
    try {
      const created = await createSosAlert({
        emergency_type: emergencyType,
        description: sosDesc.trim() || `${emergencyType} reported via Android SOS Hub`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        reporter_name: reporterName.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
        confirmed: true,
      });
      setActiveSos(created);
      const sosDisplayId = created.case_id || created.sos_id || created.tracking_id;
      setSosTrackInput(sosDisplayId);
      setSosConfirmed(false);
      Alert.alert(
        'SOS Alert Dispatched',
        `Emergency Case ID: ${sosDisplayId}\nPriority: CRITICAL\nAssigned Officer Control Room notified.`
      );
    } catch (err) {
      Alert.alert('SOS Error', err.userMessage || 'Failed to dispatch SOS alert.');
    } finally {
      setSosSubmitting(false);
    }
  };

  const handleTrackSos = async () => {
    if (!sosTrackInput.trim()) return;
    try {
      const res = await trackSosAlert(sosTrackInput.trim());
      setActiveSos(res);
    } catch (err) {
      Alert.alert('Not Found', err.userMessage || 'SOS Alert ID not found.');
    }
  };

  const handleCancelSos = async () => {
    const targetSosId = activeSos?.case_id || activeSos?.sos_id || activeSos?.tracking_id;
    if (!targetSosId) return;
    try {
      const res = await cancelSosAlert(targetSosId, 'Cancelled by citizen from mobile app');
      setActiveSos(res);
      Alert.alert('SOS Cancelled', `Alert ${res.case_id || res.sos_id || res.tracking_id} has been marked as CANCELLED.`);
    } catch (err) {
      Alert.alert('Error', err.userMessage || 'Could not cancel SOS alert.');
    }
  };

  // Voice & AI Assistant Handlers
  const handleAnalyzeVoice = async (textOverride) => {
    const text = (textOverride ?? voiceInput).trim();
    if (!text) return;
    setVoiceLoading(true);
    try {
      const res = await processVoiceCommand({
        transcript: text,
        language: 'auto',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setVoiceAnalysis(res);
    } catch (err) {
      Alert.alert('Voice AI Error', err.userMessage || 'Failed to analyze voice command.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleSendChat = async (promptOverride) => {
    const msg = (promptOverride ?? chatInput).trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: 'user', text: msg }]);
    if (!promptOverride) setChatInput('');
    setChatLoading(true);
    try {
      const trkMatch = msg.match(/(?:CP|SOS)-(?:\d{4}-\d{5}|[A-Z0-9]{6,10})/i);
      const res = await askCivicAssistant({
        message: msg,
        language: language === 'ta' ? 'ta' : 'en',
        tracking_id: trkMatch ? trkMatch[0].toUpperCase() : undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          source: res.ai_source,
          actions: res.suggested_actions || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.userMessage || 'Unable to reach AI Assistant.',
          source: 'error',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleInspectRoute = async (item) => {
    try {
      const rt = await estimateRoute({
        from_lat: coords.latitude,
        from_lng: coords.longitude,
        to_lat: item.latitude,
        to_lng: item.longitude,
        mode: 'driving',
      });
      setSelectedRoute({ item, route: rt });
    } catch {
      // Ignore error
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="SOS, Voice AI & Live GIS"
        subtitle="Unified Civic Intelligence & Emergency Hub"
        showLanguageToggle={true}
      />

      {/* Top Mode Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('sos')}
          style={[styles.tabBtn, activeTab === 'sos' && styles.tabBtnSosActive]}
        >
          <Siren size={15} color={activeTab === 'sos' ? colors.white : colors.danger} />
          <Text style={[styles.tabBtnText, activeTab === 'sos' && styles.tabBtnTextActive]}>
            SOS Emergency
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('assistant')}
          style={[styles.tabBtn, activeTab === 'assistant' && styles.tabBtnActive]}
        >
          <Bot size={15} color={activeTab === 'assistant' ? colors.white : colors.tealDark} />
          <Text style={[styles.tabBtnText, activeTab === 'assistant' && styles.tabBtnTextActive]}>
            Voice & AI
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('gis')}
          style={[styles.tabBtn, activeTab === 'gis' && styles.tabBtnActive]}
        >
          <Compass size={15} color={activeTab === 'gis' ? colors.white : colors.primary} />
          <Text style={[styles.tabBtnText, activeTab === 'gis' && styles.tabBtnTextActive]}>
            Live GIS ({nearbyData.count})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Shared Live GPS Bar */}
        <Card style={styles.gpsBar}>
          <View style={styles.gpsRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color={colors.teal} />
                <Text style={styles.gpsCoords}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} (±{coords.accuracy}m)
                </Text>
              </View>
              <Text style={styles.gpsAddress} numberOfLines={1}>
                {geoInfo?.formatted_address || 'Tamil Nadu Municipal GIS Grid'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={acquireDeviceGps}
              disabled={gpsLoading}
              style={styles.gpsRefreshBtn}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <RefreshCw size={12} color={colors.white} />
                  <Text style={styles.gpsRefreshText}>Live GPS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* ================================================================= */}
        {/* TAB 1: SOS EMERGENCY RESPONSE SYSTEM                              */}
        {/* ================================================================= */}
        {activeTab === 'sos' && (
          <View>
            {/* Emergency Hotline Banner */}
            <View style={styles.hotlineBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <PhoneCall size={16} color="#991B1B" style={{ marginRight: 6 }} />
                <Text style={styles.hotlineTitle}>
                  Official Emergency Hotlines: 112 (All) • 108 (Medical) • 101 (Fire)
                </Text>
              </View>
              <Text style={styles.hotlineSub}>
                CivicPulse SOS dispatches immediate GPS alerts to the Municipal Emergency Control Room. For life-threatening situations, also dial 112.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:112')}
                  style={styles.call112Btn}
                >
                  <Text style={styles.call112Text}>Dial 112 Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL('tel:108')}
                  style={[styles.call112Btn, { backgroundColor: '#B91C1C' }]}
                >
                  <Text style={styles.call112Text}>Dial 108 Ambulance</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>1. Select Emergency Category</Text>
              <View style={styles.pillWrap}>
                {EMERGENCY_TYPES.map((type) => {
                  const selected = emergencyType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setEmergencyType(type)}
                      style={[styles.typePill, selected && styles.typePillSelected]}
                    >
                      <Text style={[styles.typePillText, selected && styles.typePillTextSelected]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                2. Emergency Details & Contact (Optional)
              </Text>
              <TextInput
                value={sosDesc}
                onChangeText={setSosDesc}
                placeholder="Describe emergency situation & landmark (Tamil or English)..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={2}
                style={styles.textArea}
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  value={reporterName}
                  onChangeText={setReporterName}
                  placeholder="Your Name"
                  placeholderTextColor={colors.slate400}
                  style={[styles.inputBox, { flex: 1 }]}
                />
                <TextInput
                  value={reporterPhone}
                  onChangeText={setReporterPhone}
                  placeholder="Phone Number"
                  placeholderTextColor={colors.slate400}
                  keyboardType="phone-pad"
                  style={[styles.inputBox, { flex: 1 }]}
                />
              </View>

              {/* Mandatory Safety Confirmation Gate */}
              <TouchableOpacity
                onPress={() => setSosConfirmed(!sosConfirmed)}
                style={[
                  styles.confirmGate,
                  sosConfirmed && styles.confirmGateChecked,
                ]}
              >
                <CheckCircle2
                  size={20}
                  color={sosConfirmed ? '#991B1B' : colors.slate400}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.confirmGateText}>
                  I confirm this is a real emergency and authorize live GPS transmission to Municipal Responders.
                </Text>
              </TouchableOpacity>

              <Button
                title={sosSubmitting ? 'Dispatching SOS Alert...' : 'ACTIVATE SOS EMERGENCY ALERT'}
                onPress={handleSendSos}
                variant="danger"
                loading={sosSubmitting}
                disabled={!sosConfirmed || sosSubmitting}
                style={{ marginTop: 12, backgroundColor: '#DC2626' }}
              />
            </Card>

            {/* Track / Cancel SOS */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Track or Cancel SOS Alert</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TextInput
                  value={sosTrackInput}
                  onChangeText={setSosTrackInput}
                  placeholder="SOS-XXXXXXXX"
                  placeholderTextColor={colors.slate400}
                  autoCapitalize="characters"
                  style={[styles.inputBox, { flex: 1 }]}
                />
                <TouchableOpacity onPress={handleTrackSos} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>Track</Text>
                </TouchableOpacity>
              </View>

              {activeSos && (
                <View style={styles.sosStatusBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.sosIdText}>
                      {activeSos.case_id || activeSos.sos_id || activeSos.tracking_id}
                    </Text>
                    <Text style={styles.sosBadge}>{activeSos.status}</Text>
                  </View>
                  <Text style={styles.sosMetaText}>
                    {activeSos.emergency_type} • {activeSos.address_text}
                  </Text>
                  {activeSos.status !== 'RESOLVED' && activeSos.status !== 'CANCELLED' && (
                    <TouchableOpacity onPress={handleCancelSos} style={styles.cancelSosBtn}>
                      <Text style={styles.cancelSosText}>Cancel False / Resolved SOS</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: TAMIL / ENGLISH VOICE & GEMINI AI ASSISTANT                */}
        {/* ================================================================= */}
        {activeTab === 'assistant' && (
          <View>
            <Card style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Mic size={16} color={colors.tealDark} />
                <Text style={styles.sectionTitle}>
                  Tamil (தமிழ்) & English Voice Command Triage
                </Text>
              </View>
              <Text style={styles.helperText}>
                Preserves native Tamil Unicode script (never converts Tamil to Tanglish) and extracts AI category, priority, and intent.
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {VOICE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => {
                      setVoiceInput(p.text);
                      handleAnalyzeVoice(p.text);
                    }}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                value={voiceInput}
                onChangeText={setVoiceInput}
                placeholder="Type or dictate using Android Tamil/English voice keyboard..."
                placeholderTextColor={colors.slate400}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => handleAnalyzeVoice()}
                  disabled={voiceLoading}
                  style={[styles.actionBtn, { flex: 1 }]}
                >
                  <Text style={styles.actionBtnText}>
                    {voiceLoading ? 'Analyzing...' : 'Analyze Voice Intent & Triage'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Report')}
                  style={[styles.actionBtn, { backgroundColor: colors.tealDark }]}
                >
                  <Text style={styles.actionBtnText}>Open Report Form</Text>
                </TouchableOpacity>
              </View>

              {voiceAnalysis && (
                <View style={styles.voiceResultBox}>
                  <Text style={styles.voiceResultTitle}>
                    Intent: {voiceAnalysis.intent} • Lang: {voiceAnalysis.detected_language}
                  </Text>
                  <Text style={styles.voiceResultSub}>
                    Category: {voiceAnalysis.category} ({voiceAnalysis.department}) • Priority:{' '}
                    {voiceAnalysis.priority}
                  </Text>
                  <Text style={styles.voiceReplyText}>{voiceAnalysis.spoken_response}</Text>
                </View>
              )}
            </Card>

            {/* Gemini AI Civic Chat */}
            <Card style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>Gemini AI Civic Assistant</Text>
              </View>

              {messages.map((m, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.chatBubble,
                    m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAi,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatText,
                      m.role === 'user' ? { color: colors.white } : { color: colors.slate800 },
                    ]}
                  >
                    {m.text}
                  </Text>
                  {m.actions && m.actions.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {m.actions.map((act, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => handleSendChat(act)}
                          style={styles.suggestChip}
                        >
                          <Text style={styles.suggestChipText}>{act}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Ask in Tamil or English (e.g., Track CP-77B36589)..."
                  placeholderTextColor={colors.slate400}
                  style={[styles.inputBox, { flex: 1 }]}
                />
                <TouchableOpacity
                  onPress={() => handleSendChat()}
                  disabled={chatLoading}
                  style={styles.sendBtn}
                >
                  <Send size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: LIVE GIS NEARBY ISSUES & ROUTE ESTIMATOR                   */}
        {/* ================================================================= */}
        {activeTab === 'gis' && (
          <View>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Search Radius Around Your GPS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {[500, 1000, 2000, 5000].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRadiusM(r)}
                    style={[styles.typePill, radiusM === r && styles.typePillSelected]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        radiusM === r && styles.typePillTextSelected,
                      ]}
                    >
                      {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedRoute && (
                <View style={styles.routeCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Navigation size={14} color={colors.tealDark} />
                    <Text style={styles.routeTitle}>
                      Route to {selectedRoute.item.tracking_id}: {selectedRoute.route.distance_m}m (
                      {selectedRoute.route.Compass_direction || selectedRoute.route.compass_direction}
                      ) • ETA ~{selectedRoute.route.estimated_minutes} min
                    </Text>
                  </View>
                </View>
              )}
            </Card>

            {gisLoading ? (
              <ActivityIndicator size="large" color={colors.teal} style={{ marginVertical: 20 }} />
            ) : nearbyData.items?.length === 0 ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.helperText}>
                  No civic complaints reported within {radiusM}m of this coordinate. Try increasing the radius to 5 km.
                </Text>
              </Card>
            ) : (
              nearbyData.items.map((item) => {
                const displayCaseId = item.case_id || item.tracking_id;
                return (
                  <Card key={item.id} style={styles.nearbyCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.nearbyTrk}>{displayCaseId}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} />
                      </View>
                    </View>
                    <Text style={styles.nearbyCat}>
                      {item.category} • {item.distance_m}m away
                    </Text>
                    <Text style={styles.nearbyDesc} numberOfLines={2}>
                      {item.citizen_text}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleInspectRoute(item)}
                        style={styles.presetChip}
                      >
                        <Text style={styles.presetChipText}>Estimate Route & ETA</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate('Track', { trackingId: displayCaseId })
                        }
                        style={styles.presetChip}
                      >
                        <Text style={styles.presetChipText}>View Lifecycle</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.slate100,
    gap: 5,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnSosActive: { backgroundColor: '#DC2626' },
  tabBtnText: { fontSize: 11, fontWeight: '800', color: colors.slate700 },
  tabBtnTextActive: { color: colors.white },
  scrollContent: { padding: 14, paddingBottom: 36 },
  gpsBar: { marginBottom: 12, padding: 12, backgroundColor: '#F0FDFA', borderColor: '#99F6E4' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gpsCoords: { fontSize: 12, fontWeight: '800', color: colors.primary },
  gpsAddress: { fontSize: 11, color: colors.slate600, marginTop: 2 },
  gpsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  gpsRefreshText: { fontSize: 11, fontWeight: '700', color: colors.white },
  hotlineBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  hotlineTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B', flex: 1 },
  hotlineSub: { fontSize: 11, color: '#7F1D1D', lineHeight: 16 },
  call112Btn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  call112Text: { color: colors.white, fontSize: 11, fontWeight: '800' },
  sectionCard: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  helperText: { fontSize: 11, color: colors.slate500, lineHeight: 16 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typePillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { fontSize: 11, fontWeight: '700', color: colors.slate700 },
  typePillTextSelected: { color: colors.white },
  textArea: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.slate900,
    marginTop: 6,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  inputBox: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.slate900,
  },
  confirmGate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  confirmGateChecked: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  confirmGateText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#881337' },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  sosStatusBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  sosIdText: { fontSize: 14, fontWeight: '900', color: '#991B1B' },
  sosBadge: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  sosMetaText: { fontSize: 11, color: colors.slate700, marginTop: 4 },
  cancelSosBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignSelf: 'flex-start',
  },
  cancelSosText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  presetChip: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  presetChipText: { fontSize: 11, fontWeight: '700', color: colors.tealDark },
  voiceResultBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  voiceResultTitle: { fontSize: 12, fontWeight: '800', color: colors.primary },
  voiceResultSub: { fontSize: 11, fontWeight: '700', color: colors.tealDark, marginTop: 2 },
  voiceReplyText: { fontSize: 12, color: colors.slate700, marginTop: 6 },
  chatBubble: { padding: 10, borderRadius: 12, marginBottom: 8 },
  chatBubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end', maxWidth: '88%' },
  chatBubbleAi: {
    backgroundColor: colors.slate100,
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatText: { fontSize: 12, lineHeight: 18 },
  suggestChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestChipText: { fontSize: 10, fontWeight: '700', color: colors.tealDark },
  sendBtn: {
    backgroundColor: colors.tealDark,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  routeTitle: { fontSize: 11, fontWeight: '800', color: colors.tealDark, flex: 1 },
  nearbyCard: { marginBottom: 10 },
  nearbyTrk: { fontSize: 14, fontWeight: '800', color: colors.primary },
  nearbyCat: { fontSize: 11, fontWeight: '700', color: colors.tealDark, marginVertical: 4 },
  nearbyDesc: { fontSize: 12, color: colors.slate700 },
});

export default CivicHubScreen;

