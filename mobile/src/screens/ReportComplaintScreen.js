import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { createComplaint } from '../services/complaintService';
import { getMediaUrl } from '../services/api';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import CaseIdCard from '../components/CaseIdCard';
import {
  Camera,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Send,
  RotateCcw,
  ArrowRight,
  Navigation,
  Cpu,
} from 'lucide-react-native';

const CATEGORIES = [
  { id: '', labelKey: 'autoDetectAI' },
  { id: 'Pothole', labelKey: 'catPothole' },
  { id: 'Garbage', labelKey: 'catGarbage' },
  { id: 'Water', labelKey: 'catWater' },
  { id: 'Streetlight', labelKey: 'catStreetlight' },
  { id: 'Drainage', labelKey: 'catDrainage' },
  { id: 'Other', labelKey: 'catOther' },
];

const QUICK_TEMPLATES = [
  {
    labelEn: 'Pothole (Tamil)',
    text: 'சாலையில் மிகப்பெரிய பள்ளம் உள்ளது, இருசக்கர வாகன ஓட்டிகளுக்கு விபத்து அபாயம் உள்ளது.',
    cat: 'Pothole',
  },
  {
    labelEn: 'Water Burst (Tamil)',
    text: 'குடிநீர் குழாய் உடைந்து சாலையில் பெருமளவு குடிநீர் வீணாகி வருகிறது.',
    cat: 'Water',
  },
  {
    labelEn: 'Garbage (English)',
    text: 'Large pile of uncollected garbage overflowing near main road junction causing foul smell.',
    cat: 'Garbage',
  },
  {
    labelEn: 'Streetlight (English)',
    text: 'Streetlight pole not working for 5 days leaving pedestrian stretch in complete darkness.',
    cat: 'Streetlight',
  },
];

const TOWN_PRESETS = [
  { name: 'Tiruchengode / KSRIET', lat: '11.3635', lng: '77.8282' },
  { name: 'Coimbatore Central', lat: '11.0168', lng: '76.9558' },
  { name: 'Erode Junction', lat: '11.3410', lng: '77.7172' },
  { name: 'Salem Bus Stand', lat: '11.6643', lng: '78.1460' },
];

export const ReportComplaintScreen = ({ navigation }) => {
  const { t, language } = useLanguage();

  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [landmark, setLandmark] = useState('');
  const [latitude, setLatitude] = useState('11.3635');
  const [longitude, setLongitude] = useState('77.8282');
  const [gpsStatus, setGpsStatus] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);

  const [photoAsset, setPhotoAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `mob-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  const detectLocation = async () => {
    setDetectingGps(true);
    setGpsStatus(language === 'ta' ? 'ஜி.பி.எஸ் இருப்பிடம் கண்டறியப்படுகிறது...' : 'Requesting GPS coordinates...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus(
          language === 'ta'
            ? 'ஜிபிஎஸ் அனுமதி மறுக்கப்பட்டது. கைமுறையாகத் திருத்தலாம்.'
            : 'GPS permission denied. Using manual / preset coordinates.'
        );
        setDetectingGps(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latStr = loc.coords.latitude.toFixed(6);
      const lngStr = loc.coords.longitude.toFixed(6);
      setLatitude(latStr);
      setLongitude(lngStr);

      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (places && places.length > 0) {
          const p = places[0];
          const addr = [p.street || p.name, p.Subregion || p.city, p.region]
            .filter(Boolean)
            .join(', ');
          if (addr && !landmark) {
            setLandmark(addr);
          }
        }
      } catch {
        // Reverse geocode optional
      }

      setGpsStatus(
        language === 'ta'
          ? `ஜிபிஎஸ் துல்லியமாகப் பெறப்பட்டது (${latStr}, ${lngStr})`
          : `Live GPS locked (${latStr}, ${lngStr})`
      );
    } catch {
      setGpsStatus(
        language === 'ta'
          ? 'ஜிபிஎஸ் சிக்னல் கிடைக்கவில்லை. கீழே உள்ள ஆயத்தொலைவுகளைப் பயன்படுத்தவும்.'
          : 'GPS unavailable on device/emulator. Manual coordinates active.'
      );
    } finally {
      setDetectingGps(false);
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to capture civic issue photo evidence.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.length > 0) {
        setPhotoAsset(res.assets[0]);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not launch camera. Try choosing from Gallery.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Please allow photo library access to attach evidence.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.length > 0) {
        setPhotoAsset(res.assets[0]);
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not open image gallery.');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setError(
        language === 'ta'
          ? 'தயவுசெய்து புகாரின் விவரத்தை உள்ளிடவும்.'
          : 'Please enter a description of the civic problem.'
      );
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (
      isNaN(latNum) ||
      isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      setError(
        language === 'ta'
          ? 'சரியான ஜிபிஎஸ் அட்சரேகை மற்றும் தீர்க்கரேகையை உள்ளிடவும்.'
          : 'Please enter valid GPS latitude (-90 to 90) and longitude (-180 to 180).'
      );
      return;
    }

    setSubmitting(true);
    try {
      let fullText = cleanDesc;
      if (selectedCategory && !fullText.toLowerCase().includes(selectedCategory.toLowerCase())) {
        fullText = `[${selectedCategory}] ${fullText}`;
      }
      if (landmark.trim()) {
        fullText = `${fullText} (Landmark: ${landmark.trim()})`;
      }

      const created = await createComplaint({
        citizen_text: fullText,
        latitude: latNum,
        longitude: lngNum,
        photoAsset,
        idempotency_key: idempotencyKey,
      });
      setResult(created);
    } catch (err) {
      setError(err.userMessage || t('networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setSelectedCategory('');
    setLandmark('');
    setPhotoAsset(null);
    setResult(null);
    setError(null);
    setIdempotencyKey(`mob-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  };

  const isGemini = (src) => String(src || '').toUpperCase().includes('GEMINI');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title={t('reportTitle')}
        subtitle={t('reportSubtitle')}
        showLanguageToggle={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {result ? (
          /* Confirmation Screen */
          <View style={styles.confirmContainer}>
            <Card style={styles.confirmCard}>
              <View style={styles.confirmHeader}>
                <View style={styles.successIconBox}>
                  <CheckCircle2 size={32} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmTag}>{t('registeredSuccess')}</Text>
                  <Text style={styles.trackingIdText}>
                    {result.case_id || result.tracking_id}
                  </Text>
                </View>
              </View>

              <CaseIdCard
                caseId={result.case_id || result.tracking_id}
                trackingId={result.tracking_id}
                status={result.status}
                priority={result.priority}
                createdAt={result.created_at}
                showActions={true}
                onTrackPress={() =>
                  navigation.navigate('Track', {
                    trackingId: result.case_id || result.tracking_id,
                  })
                }
                onViewDetailsPress={() =>
                  navigation.navigate('Track', {
                    trackingId: result.case_id || result.tracking_id,
                  })
                }
              />

              {/* AI Triage Box */}
              <View style={styles.aiBox}>
                <View style={styles.aiHeaderRow}>
                  <Cpu size={16} color={colors.tealDark} style={{ marginRight: 6 }} />
                  <Text style={styles.aiTitle}>{t('aiTriageResult')}</Text>
                </View>

                <View
                  style={[
                    styles.sourceBadge,
                    isGemini(result.ai_source) ? styles.sourceGemini : styles.sourceFallback,
                  ]}
                >
                  <Sparkles
                    size={12}
                    color={isGemini(result.ai_source) ? colors.tealDark : '#B45309'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.sourceBadgeText,
                      { color: isGemini(result.ai_source) ? colors.tealDark : '#B45309' },
                    ]}
                  >
                    {isGemini(result.ai_source)
                      ? t('classifiedByGemini')
                      : t('classifiedByFallback')}
                  </Text>
                </View>

                <View style={styles.triageGrid}>
                  <View style={styles.triageItem}>
                    <Text style={styles.triageLabel}>CATEGORY</Text>
                    <Text style={styles.triageValue}>{result.category}</Text>
                  </View>
                  <View style={styles.triageItem}>
                    <Text style={styles.triageLabel}>DEPARTMENT</Text>
                    <Text style={styles.triageValue}>{result.department}</Text>
                  </View>
                </View>

                <View style={styles.triageGrid}>
                  <View style={styles.triageItem}>
                    <Text style={styles.triageLabel}>GPS LOCATION</Text>
                    <Text style={styles.triageValue}>
                      {Number(result.latitude).toFixed(4)}°N, {Number(result.longitude).toFixed(4)}°E
                    </Text>
                  </View>
                </View>

                <View style={styles.badgesRow}>
                  <View style={{ marginRight: 12 }}>
                    <Text style={styles.triageLabel}>PRIORITY</Text>
                    <PriorityBadge priority={result.priority} />
                  </View>
                  <View>
                    <Text style={styles.triageLabel}>STATUS</Text>
                    <StatusBadge status={result.status} />
                  </View>
                </View>
              </View>

              {/* Duplicate Detection Warning */}
              {result.duplicate_group_id && (
                <View style={styles.duplicateBox}>
                  <View style={styles.dupHeader}>
                    <AlertTriangle size={18} color="#B45309" style={{ marginRight: 6 }} />
                    <Text style={styles.dupTitle}>{t('duplicateWarningTitle')}</Text>
                  </View>
                  <Text style={styles.dupDesc}>{t('duplicateWarningDesc')}</Text>
                  <Text style={styles.dupMeta}>
                    Cluster Group: {result.duplicate_group_id}
                    {result.duplicate_confidence
                      ? ` • Similarity: ${Math.round(result.duplicate_confidence * 100)}%`
                      : ''}
                  </Text>
                </View>
              )}

              {/* Photo Preview if uploaded */}
              {(result.photo_url || photoAsset?.uri) && (
                <View style={styles.confirmPhotoBox}>
                  <Text style={styles.triageLabel}>ATTACHED PHOTO EVIDENCE</Text>
                  <Image
                    source={{ uri: result.photo_url ? getMediaUrl(result.photo_url) : photoAsset.uri }}
                    style={styles.confirmPhoto}
                    resizeMode="cover"
                  />
                </View>
              )}

              <View style={styles.confirmActions}>
                <Button
                  title={t('trackThisNow')}
                  variant="teal"
                  icon={<ArrowRight size={16} color={colors.white} />}
                  onPress={() =>
                    navigation.navigate('Track', {
                      trackingId: result.case_id || result.tracking_id,
                    })
                  }
                  style={{ marginBottom: 10 }}
                />
                <Button
                  title={t('reportAnother')}
                  variant="outline"
                  icon={<RotateCcw size={16} color={colors.primary} />}
                  onPress={handleReset}
                />
              </View>
            </Card>
          </View>
        ) : (
          /* Registration Form */
          <View>
            {error && (
              <View style={styles.errorBanner}>
                <AlertTriangle size={18} color={colors.danger} style={{ marginRight: 8 }} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Quick Bilingual Templates */}
            <Card style={styles.sectionCard}>
              <View style={styles.rowCenter}>
                <Sparkles size={16} color={colors.tealDark} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>{t('quickTemplates')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.templateScroll}
              >
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.templateChip}
                    onPress={() => {
                      setDescription(tpl.text);
                      setSelectedCategory(tpl.cat);
                      setError(null);
                    }}
                  >
                    <Text style={styles.templateChipText}>{tpl.labelEn}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input
                label={t('issueDescription')}
                value={description}
                onChangeText={(txt) => {
                  setDescription(txt);
                  if (error) setError(null);
                }}
                placeholder={t('descriptionPlaceholder')}
                multiline={true}
                numberOfLines={4}
              />

              {/* Category Pills */}
              <Text style={styles.fieldLabel}>{t('selectCategory')}</Text>
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id || 'auto'}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[styles.catChip, active && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                        {t(cat.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            {/* Photo Evidence Section */}
            <Card style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>{t('photoEvidence')}</Text>
              {photoAsset ? (
                <View style={styles.photoPreviewBox}>
                  <Image
                    source={{ uri: photoAsset.uri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setPhotoAsset(null)}
                  >
                    <Trash2 size={16} color={colors.white} />
                    <Text style={styles.removePhotoText}>{t('removePhoto')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtonsRow}>
                  <TouchableOpacity style={styles.photoActionBtn} onPress={handleTakePhoto}>
                    <Camera size={22} color={colors.tealDark} />
                    <Text style={styles.photoActionText}>{t('takePhoto')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickGallery}>
                    <ImageIcon size={22} color={colors.primary} />
                    <Text style={styles.photoActionText}>{t('chooseGallery')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>

            {/* GPS Location Section */}
            <Card style={styles.sectionCard}>
              <View style={styles.gpsHeaderRow}>
                <View style={styles.rowCenter}>
                  <MapPin size={16} color={colors.tealDark} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>{t('gpsLocation')}</Text>
                </View>

                <TouchableOpacity
                  style={styles.detectGpsBtn}
                  onPress={detectLocation}
                  disabled={detectingGps}
                >
                  {detectingGps ? (
                    <ActivityIndicator size="small" color={colors.tealDark} />
                  ) : (
                    <>
                      <Navigation size={13} color={colors.tealDark} style={{ marginRight: 4 }} />
                      <Text style={styles.detectGpsText}>{t('detectGPS')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {gpsStatus ? <Text style={styles.gpsStatusText}>{gpsStatus}</Text> : null}

              <View style={styles.coordsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label="LATITUDE"
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="numeric"
                    placeholder="11.3635"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="LONGITUDE"
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="numeric"
                    placeholder="77.8282"
                  />
                </View>
              </View>

              {/* Town Presets for Emulator Convenience */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {TOWN_PRESETS.map((town) => (
                  <TouchableOpacity
                    key={town.name}
                    style={styles.townPill}
                    onPress={() => {
                      setLatitude(town.lat);
                      setLongitude(town.lng);
                      setLandmark(town.name);
                    }}
                  >
                    <Text style={styles.townPillText}>{town.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input
                label="LANDMARK / STREET ADDRESS"
                value={landmark}
                onChangeText={setLandmark}
                placeholder={t('landmarkPlaceholder')}
              />
            </Card>

            <Button
              title={submitting ? t('submittingComplaint') : t('submitComplaint')}
              onPress={handleSubmit}
              variant="teal"
              loading={submitting}
              icon={!submitting ? <Send size={18} color={colors.white} /> : null}
              style={styles.submitBtn}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    marginBottom: 14,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  templateScroll: {
    marginTop: 10,
    marginBottom: 14,
  },
  templateChip: {
    backgroundColor: colors.tealLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tealDark,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  catChipTextActive: {
    color: colors.white,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoActionBtn: {
    flex: 1,
    height: 84,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.slate300,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  photoPreviewBox: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPreview: {
    width: '100%',
    height: 190,
    backgroundColor: colors.slate200,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 10,
    gap: 6,
  },
  removePhotoText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detectGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detectGpsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tealDark,
  },
  gpsStatusText: {
    fontSize: 11,
    color: colors.slate500,
    marginBottom: 10,
  },
  coordsRow: {
    flexDirection: 'row',
  },
  townPill: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  townPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate700,
  },
  submitBtn: {
    marginTop: 4,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },
  confirmContainer: {
    paddingTop: 4,
  },
  confirmCard: {
    padding: 20,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  successIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  confirmTag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackingIdText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2,
  },
  saveNote: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 16,
    lineHeight: 18,
  },
  aiBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  sourceGemini: {
    backgroundColor: colors.tealLight,
  },
  sourceFallback: {
    backgroundColor: '#FEF3C7',
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  triageGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  triageItem: {
    flex: 1,
  },
  triageLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate400,
    marginBottom: 4,
  },
  triageValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duplicateBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  dupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  dupDesc: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  dupMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 6,
  },
  confirmPhotoBox: {
    marginBottom: 16,
  },
  confirmPhoto: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    marginTop: 4,
  },
  confirmActions: {
    marginTop: 6,
  },
});

export default ReportComplaintScreen;

