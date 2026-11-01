import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  Image,
  Linking,
} from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { trackComplaint, getRecentMobileCases } from '../services/complaintService';
import { getMediaUrl, connectLiveUpdates } from '../services/api';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import CaseIdCard from '../components/CaseIdCard';
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  FileCheck,
  ExternalLink,
  History,
  Cpu,
  Layers,
} from 'lucide-react-native';

export const TrackComplaintScreen = ({ route }) => {
  const { t, language } = useLanguage();
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [error, setError] = useState(null);

  const loadRecent = useCallback(async () => {
    const list = await getRecentMobileCases();
    setRecentCases(list);
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const performLookup = useCallback(
    async (idToLookup) => {
      const clean = String(idToLookup || '').trim().toUpperCase();
      if (!clean) {
        setError(
          language === 'ta'
            ? 'வழக்கு எண்ணை (Case ID) உள்ளிடவும்'
            : 'Please enter a Case ID.'
        );
        return;
      }

      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const data = await trackComplaint(clean);
        setResult(data);
        loadRecent();
      } catch (err) {
        setError(
          err.userMessage ||
            (language === 'ta'
              ? 'புகார் எண் காணப்படவில்லை. எண்ணை சரிபார்க்கவும்.'
              : 'No grievance found matching this Case ID. Please verify.')
        );
      } finally {
        setLoading(false);
      }
    },
    [language, loadRecent]
  );

  useEffect(() => {
    const incomingId = route?.params?.trackingId || route?.params?.initialTrackingId;
    if (incomingId) {
      setTrackingId(incomingId);
      performLookup(incomingId);
    }
  }, [route?.params?.trackingId, route?.params?.initialTrackingId, performLookup]);

  useEffect(() => {
    if (!result) return undefined;
    const activeCaseId = result.case_id || result.tracking_id;
    const disconnect = connectLiveUpdates((evt) => {
      if (
        evt.case_id === activeCaseId ||
        evt.tracking_id === result.tracking_id ||
        evt.tracking_id === activeCaseId
      ) {
        performLookup(activeCaseId);
      }
    });
    return disconnect;
  }, [result, performLookup]);

  const handleSearch = () => {
    performLookup(trackingId);
  };

  const openInMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const getTimelineSteps = (currentStatus) => {
    const status = String(currentStatus || '').toUpperCase();
    const baseSteps = [
      {
        key: 'SUBMITTED',
        label: 'Submitted',
        desc: 'Complaint registered & triaged by CivicPulse AI',
        state: 'completed',
      },
      {
        key: 'IN_PROGRESS',
        label: 'In Progress',
        desc: 'Assigned municipal officer inspecting & addressing issue',
        state:
          status === 'IN_PROGRESS'
            ? 'active'
            : status === 'RESOLVED'
            ? 'completed'
            : 'pending',
      },
    ];

    if (status === 'NEEDS_INFO') {
      baseSteps.push({
        key: 'NEEDS_INFO',
        label: 'Needs Information',
        desc: 'Additional landmark or clarification requested by officer',
        state: 'active',
      });
    }

    baseSteps.push({
      key: 'RESOLVED',
      label: 'Resolved',
      desc: 'Verified completion with mandatory officer photo evidence',
      state: status === 'RESOLVED' ? 'completed' : 'pending',
    });

    return baseSteps;
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('trackStatus')}
        subtitle={
          language === 'ta' ? 'புகாரின் நிலை அறிதல்' : 'Live Grievance Redressal Status'
        }
        showLanguageToggle={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Card */}
        <Card style={styles.searchCard}>
          <Text style={styles.searchTitle}>
            {language === 'ta'
              ? 'வழக்கு எண் (Case ID) மூலம் தேடுங்கள்'
              : 'Enter Your Unified Case ID'}
          </Text>
          <Text style={styles.searchDesc}>
            {language === 'ta'
              ? 'புகார் பதிவு செய்த போது வழங்கப்பட்ட வழக்கு எண் (எ.கா. CP-2026-00093)'
              : 'Enter the Case ID provided upon registration (e.g., CP-2026-00093 or CP-6D07D491)'}
          </Text>

          <Input
            value={trackingId}
            onChangeText={(text) => {
              setTrackingId(text.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="e.g. CP-2026-00093"
            autoCapitalize="characters"
            icon={<Search size={18} color={colors.slate400} />}
            style={{ marginBottom: 12 }}
          />

          <Button
            title={
              loading
                ? t('loading')
                : language === 'ta'
                ? 'நிலையை சரிபார்'
                : 'Track Grievance'
            }
            onPress={handleSearch}
            variant="teal"
            loading={loading}
            icon={!loading ? <Search size={16} color={colors.white} /> : null}
          />

          {recentCases.length > 0 && (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.slate400, marginBottom: 6 }}>
                {language === 'ta' ? 'சமீபத்திய வழக்கு எண்கள்:' : 'RECENT CASE IDS:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {recentCases.slice(0, 5).map((rc) => {
                  const cid = rc.case_id || rc.tracking_id;
                  return (
                    <TouchableOpacity
                      key={cid}
                      onPress={() => {
                        setTrackingId(cid);
                        performLookup(cid);
                      }}
                      style={{
                        backgroundColor: colors.slate100,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                        {cid}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* Error Notice */}
        {error && (
          <View style={styles.errorNotice}>
            <AlertCircle size={20} color={colors.danger} style={{ marginRight: 10 }} />
            <Text style={styles.errorNoticeText}>{error}</Text>
          </View>
        )}

        {/* Search Result */}
        {result && (
          <View style={styles.resultContainer}>
            {/* Unified Case ID Banner */}
            <CaseIdCard
              caseId={result.case_id || result.tracking_id}
              trackingId={result.tracking_id}
              status={result.status}
              priority={result.priority}
              createdAt={result.created_at}
              showActions={true}
            />

            {/* Main Result Card */}
            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={styles.resultTrkId}>
                    {result.case_id || result.tracking_id || `CP-${result.id}`}
                  </Text>
                  <View style={styles.dateRow}>
                    <Calendar
                      size={12}
                      color={colors.slate400}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.resultDate}>
                      {result.created_at
                        ? new Date(result.created_at).toLocaleString()
                        : 'Recent'}
                    </Text>
                  </View>
                </View>
                <StatusBadge status={result.status} />
              </View>

              <View style={styles.divider} />

              {/* Badges & Meta */}
              <View style={styles.badgeRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>PRIORITY</Text>
                  <PriorityBadge priority={result.priority} />
                </View>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>CATEGORY</Text>
                  <View style={styles.deptBadge}>
                    <Text style={styles.deptText}>{result.category || 'General'}</Text>
                  </View>
                </View>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DEPARTMENT</Text>
                  <View style={styles.deptBadge}>
                    <Text style={styles.deptText}>{result.department || 'General'}</Text>
                  </View>
                </View>
              </View>

              {/* AI Source Pill */}
              <View style={styles.aiPillRow}>
                <Cpu size={13} color={colors.tealDark} style={{ marginRight: 5 }} />
                <Text style={styles.aiPillText}>
                  Triage Engine:{' '}
                  {String(result.ai_source || '').includes('GEMINI')
                    ? 'Google Gemini AI'
                    : 'Rule-Based Keyword Classifier'}
                </Text>
              </View>

              {/* Duplicate Group Info if applicable */}
              {result.duplicate_group_id && (
                <View style={styles.dupPillRow}>
                  <Layers size={13} color="#B45309" style={{ marginRight: 5 }} />
                  <Text style={styles.dupPillText}>
                    Duplicate Group: {result.duplicate_group_id}
                    {result.duplicate_confidence
                      ? ` (${Math.round(result.duplicate_confidence * 100)}% match)`
                      : ''}
                  </Text>
                </View>
              )}

              {/* Grievance Description */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>GRIEVANCE DESCRIPTION</Text>
                <Text style={styles.descText}>
                  {result.citizen_text || 'No text description.'}
                </Text>
              </View>

              {/* Location Coordinates + Map Link */}
              {result.latitude != null && result.longitude != null ? (
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={() => openInMaps(result.latitude, result.longitude)}
                >
                  <MapPin size={14} color={colors.teal} style={{ marginRight: 6 }} />
                  <Text style={styles.locationText}>
                    GPS: {Number(result.latitude).toFixed(4)}°N,{' '}
                    {Number(result.longitude).toFixed(4)}°E
                  </Text>
                  <ExternalLink size={13} color={colors.primary} />
                </TouchableOpacity>
              ) : null}

              {/* Submission Photo if present */}
              {result.photo_url && (
                <View style={styles.mediaBlock}>
                  <Text style={styles.sectionHeading}>CITIZEN PHOTO EVIDENCE</Text>
                  <Image
                    source={{ uri: getMediaUrl(result.photo_url) }}
                    style={styles.evidenceImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Resolution Details if resolved */}
              {result.status === 'RESOLVED' && (
                <View style={styles.resolutionBox}>
                  <View style={styles.resHeaderRow}>
                    <FileCheck
                      size={18}
                      color={colors.success}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.resTitle}>Verified Redressal Proof</Text>
                  </View>
                  {result.resolution_note ? (
                    <Text style={styles.resNote}>{result.resolution_note}</Text>
                  ) : null}
                  {result.resolution_photo_url && (
                    <Image
                      source={{ uri: getMediaUrl(result.resolution_photo_url) }}
                      style={styles.resolutionImage}
                      resizeMode="cover"
                    />
                  )}
                </View>
              )}
            </Card>

            {/* Lifecycle Stepper */}
            <Card style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>Redressal Lifecycle</Text>

              <View style={styles.timelineList}>
                {getTimelineSteps(result.status).map((step, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  return (
                    <View key={step.key} style={styles.timelineItem}>
                      <View style={styles.timelineLeftCol}>
                        <View
                          style={[
                            styles.timelineDot,
                            step.state === 'completed' && styles.dotCompleted,
                            step.state === 'active' && styles.dotActive,
                          ]}
                        >
                          {step.state === 'completed' ? (
                            <CheckCircle2 size={12} color={colors.white} />
                          ) : (
                            <Clock size={10} color={colors.white} />
                          )}
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine,
                              step.state === 'completed' && styles.lineCompleted,
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text
                          style={[
                            styles.stepLabel,
                            step.state === 'completed' && styles.stepLabelDone,
                          ]}
                        >
                          {step.label}
                        </Text>
                        <Text style={styles.stepDesc}>{step.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Full Audit Log History */}
            {result.logs && result.logs.length > 0 && (
              <Card style={styles.timelineCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <History size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.timelineTitle, { marginBottom: 0 }]}>
                    {t('auditHistoryTitle')}
                  </Text>
                </View>

                <View style={{ gap: 10 }}>
                  {result.logs.map((log) => (
                    <View key={log.id} style={styles.auditItem}>
                      <View style={styles.auditTopRow}>
                        <Text style={styles.auditAction}>{log.action}</Text>
                        <Text style={styles.auditTime}>
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleString()
                            : ''}
                        </Text>
                      </View>
                      <Text style={styles.auditActor}>
                        By {log.actor_name} ({log.actor_role})
                      </Text>
                      {log.note ? <Text style={styles.auditNote}>{log.note}</Text> : null}
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  searchCard: {
    marginBottom: 16,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  searchDesc: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 16,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  resultContainer: {
    gap: 16,
  },
  resultCard: {
    marginBottom: 0,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultTrkId: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  resultDate: {
    fontSize: 12,
    color: colors.slate400,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 12,
  },
  metaItem: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate400,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deptBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
  },
  aiPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  aiPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tealDark,
  },
  dupPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  dupPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate400,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descText: {
    fontSize: 14,
    color: colors.slate800,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  mediaBlock: {
    marginTop: 14,
  },
  evidenceImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: colors.slate200,
  },
  resolutionBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  resHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  resTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  resNote: {
    fontSize: 13,
    color: colors.slate700,
    lineHeight: 18,
  },
  resolutionImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: colors.slate200,
  },
  timelineCard: {
    marginBottom: 0,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.teal,
  },
  dotActive: {
    backgroundColor: colors.warning,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.slate200,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: colors.teal,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate600,
  },
  stepLabelDone: {
    color: colors.slate900,
  },
  stepDesc: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 2,
  },
  auditItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  auditTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  auditAction: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  auditTime: {
    fontSize: 10,
    color: colors.slate400,
  },
  auditActor: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.tealDark,
    marginBottom: 4,
  },
  auditNote: {
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 16,
  },
});

export default TrackComplaintScreen;
