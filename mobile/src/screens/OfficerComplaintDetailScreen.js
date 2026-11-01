import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import colors from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getComplaintDetails,
  updateComplaintStatus,
  resolveComplaint,
  listOfficers,
  assignComplaint,
} from '../services/officerService';
import { getMediaUrl, connectLiveUpdates } from '../services/api';
import Header from '../components/Header';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import CaseIdCard from '../components/CaseIdCard';
import LoadingView, { ErrorView } from '../components/LoadingView';
import {
  MapPin,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  UserCheck,
  History,
  Layers,
  Trash2,
  FileCheck,
} from 'lucide-react-native';

export const OfficerComplaintDetailScreen = ({ route, navigation }) => {
  const { complaintId } = route.params || {};
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [complaint, setComplaint] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin Assignment state
  const [selectedOfficerId, setSelectedOfficerId] = useState(null);
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Status update state
  const [targetStatus, setTargetStatus] = useState('IN_PROGRESS');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Resolution state
  const [resPhoto, setResPhoto] = useState(null);
  const [resNote, setResNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const compData = await getComplaintDetails(complaintId);
      setComplaint(compData);
      setSelectedOfficerId(compData.assigned_officer_id || null);

      if (isAdmin) {
        try {
          const offRes = await listOfficers();
          setOfficers(offRes?.items || []);
        } catch {
          // Non-blocking
        }
      }
    } catch (err) {
      setError(err.userMessage || 'Could not load complaint details.');
    } finally {
      setLoading(false);
    }
  }, [complaintId, isAdmin]);

  useEffect(() => {
    loadData();
    const disconnect = connectLiveUpdates((evt) => {
      if (String(evt.complaint_id) === String(complaintId)) {
        loadData();
      }
    });
    return disconnect;
  }, [loadData, complaintId]);

  const openMaps = () => {
    if (!complaint) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleAssignOfficer = async () => {
    if (!selectedOfficerId) {
      Alert.alert('Select Officer', 'Please choose a department officer to assign.');
      return;
    }
    setAssigning(true);
    try {
      const updated = await assignComplaint(complaint.id, selectedOfficerId, assignNote);
      setComplaint(updated);
      setAssignNote('');
      Alert.alert('Assigned', 'Complaint assigned to officer successfully.');
    } catch (err) {
      Alert.alert('Assignment Failed', err.userMessage || 'Could not assign officer.');
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusNote.trim()) {
      Alert.alert('Remarks Required', 'Please enter an inspection remark or note.');
      return;
    }
    setUpdatingStatus(true);
    try {
      const updated = await updateComplaintStatus(complaint.id, {
        status: targetStatus,
        note: statusNote.trim(),
      });
      setComplaint(updated);
      setStatusNote('');
      Alert.alert('Status Updated', `Complaint status updated to ${targetStatus}.`);
    } catch (err) {
      Alert.alert('Update Failed', err.userMessage || 'Status transition not allowed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCaptureResPhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for resolution proof.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.length > 0) {
        setResPhoto(res.assets[0]);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not launch camera.');
    }
  };

  const handlePickResPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Gallery access is needed for resolution proof.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.length > 0) {
        setResPhoto(res.assets[0]);
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not open gallery.');
    }
  };

  const handleResolveSubmit = async () => {
    if (!resPhoto) {
      Alert.alert(
        'Proof Photo Mandatory',
        'A complaint cannot be marked resolved without uploading photo evidence of the completed work.'
      );
      return;
    }
    if (!resNote.trim()) {
      Alert.alert(
        'Resolution Note Mandatory',
        'Please enter details of the field resolution work completed.'
      );
      return;
    }

    setResolving(true);
    try {
      // If complaint is still OPEN or NEEDS_INFO, transition to IN_PROGRESS first so state machine allows resolution
      if (complaint.status === 'OPEN' || complaint.status === 'NEEDS_INFO') {
        await updateComplaintStatus(complaint.id, {
          status: 'IN_PROGRESS',
          note: 'Field work initiated prior to resolution verification.',
        });
      }

      const resolved = await resolveComplaint(complaint.id, resPhoto, resNote);
      setComplaint(resolved);
      setResPhoto(null);
      setResNote('');
      Alert.alert(
        'Complaint Resolved',
        'Resolution evidence and notes have been verified and recorded.'
      );
    } catch (err) {
      Alert.alert('Resolution Failed', err.userMessage || 'Could not resolve complaint.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <LoadingView message={t('loading')} />;
  }

  if (error || !complaint) {
    return (
      <View style={styles.container}>
        <Header title="Complaint Details" showBack={true} onBack={() => navigation.goBack()} />
        <ErrorView message={error || 'Not found'} onRetry={loadData} />
      </View>
    );
  }

  // Filter officers matching complaint department for cleaner assignment
  const deptOfficers = officers.filter(
    (o) =>
      o.role === 'OFFICER' &&
      String(o.department || '').toLowerCase() === String(complaint.department || '').toLowerCase()
  );
  const assignableOfficers = deptOfficers.length > 0 ? deptOfficers : officers;

  return (
    <View style={styles.container}>
      <Header
        title={complaint.case_id || complaint.tracking_id}
        subtitle={`${complaint.category} • ${complaint.department}`}
        showBack={true}
        onBack={() => navigation.goBack()}
        showLanguageToggle={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CaseIdCard
          caseId={complaint.case_id || complaint.tracking_id}
          trackingId={complaint.tracking_id}
          status={complaint.status}
          priority={complaint.priority}
          createdAt={complaint.created_at}
          showActions={true}
        />

        {/* Overview Card */}
        <Card>
          <View style={styles.topRow}>
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </View>

          <Text style={styles.sectionLabel}>CITIZEN DESCRIPTION</Text>
          <Text style={styles.descText}>{complaint.citizen_text}</Text>

          {complaint.duplicate_group_id && (
            <View style={styles.dupBanner}>
              <Layers size={14} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.dupBannerText}>
                Duplicate Group: {complaint.duplicate_group_id}
                {complaint.duplicate_confidence
                  ? ` (${Math.round(complaint.duplicate_confidence * 100)}% confidence)`
                  : ''}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
            <MapPin size={16} color={colors.tealDark} style={{ marginRight: 6 }} />
            <Text style={styles.mapBtnText}>
              GPS: {Number(complaint.latitude).toFixed(4)}°N,{' '}
              {Number(complaint.longitude).toFixed(4)}°E (Open Maps)
            </Text>
            <ExternalLink size={14} color={colors.primary} />
          </TouchableOpacity>

          {complaint.photo_url && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>CITIZEN UPLOADED EVIDENCE</Text>
              <Image
                source={{ uri: getMediaUrl(complaint.photo_url) }}
                style={styles.evidenceImg}
                resizeMode="cover"
              />
            </View>
          )}
        </Card>

        {/* Admin: Officer Assignment Card */}
        {isAdmin && (
          <Card>
            <View style={styles.cardHeaderRow}>
              <UserCheck size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.cardTitle}>{t('assignOfficerTitle')}</Text>
            </View>

            <Text style={styles.helperText}>
              Select an officer in {complaint.department} to handle field inspection:
            </Text>

            <View style={styles.officerList}>
              {assignableOfficers.map((off) => {
                const active = selectedOfficerId === off.id;
                return (
                  <TouchableOpacity
                    key={off.id}
                    onPress={() => setSelectedOfficerId(off.id)}
                    style={[styles.officerOption, active && styles.officerOptionActive]}
                  >
                    <View>
                      <Text
                        style={[
                          styles.officerOptionName,
                          active && { color: colors.tealDark },
                        ]}
                      >
                        {off.name}
                      </Text>
                      <Text style={styles.officerOptionDept}>
                        {off.department} • {off.email}
                      </Text>
                    </View>
                    {active && <CheckCircle2 size={18} color={colors.teal} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="ASSIGNMENT DIRECTIVE (OPTIONAL)"
              value={assignNote}
              onChangeText={setAssignNote}
              placeholder="e.g. Inspect immediately and report back..."
            />

            <Button
              title={assigning ? 'Assigning...' : 'Assign Officer'}
              onPress={handleAssignOfficer}
              variant="primary"
              loading={assigning}
            />
          </Card>
        )}

        {/* Officer Status Transition Card */}
        {complaint.status !== 'RESOLVED' && (
          <Card>
            <Text style={styles.cardTitle}>{t('updateStatusTitle')}</Text>
            <View style={styles.statusOptionsRow}>
              {['IN_PROGRESS', 'NEEDS_INFO', 'REJECTED'].map((st) => {
                const active = targetStatus === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setTargetStatus(st)}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {st.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="OFFICER INSPECTION REMARKS"
              value={statusNote}
              onChangeText={setStatusNote}
              placeholder="Enter field inspection status or clarification needed..."
              multiline={true}
              numberOfLines={2}
            />

            <Button
              title="Update Status"
              onPress={handleStatusUpdate}
              variant="secondary"
              loading={updatingStatus}
            />
          </Card>
        )}

        {/* Mandatory Resolution Evidence Upload Card */}
        {complaint.status !== 'RESOLVED' ? (
          <Card style={styles.resolveCard}>
            <View style={styles.cardHeaderRow}>
              <FileCheck size={18} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: colors.success, marginBottom: 0 }]}>
                {t('resolveWithProofTitle')}
              </Text>
            </View>
            <Text style={styles.helperText}>
              Both a completion photo and resolution note are mandatory to mark this complaint
              resolved.
            </Text>

            <Text style={styles.sectionLabel}>{t('resolutionPhotoLabel')}</Text>
            {resPhoto ? (
              <View style={styles.photoPreviewBox}>
                <Image
                  source={{ uri: resPhoto.uri }}
                  style={styles.evidenceImg}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => setResPhoto(null)}
                >
                  <Trash2 size={14} color={colors.white} />
                  <Text style={styles.removeBtnText}>{t('removePhoto')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoBtnsRow}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={handleCaptureResPhoto}
                >
                  <Camera size={20} color={colors.tealDark} />
                  <Text style={styles.photoBtnText}>{t('takePhoto')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={handlePickResPhoto}
                >
                  <ImageIcon size={20} color={colors.primary} />
                  <Text style={styles.photoBtnText}>{t('chooseGallery')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <Input
              label={t('resolutionNoteLabel')}
              value={resNote}
              onChangeText={setResNote}
              placeholder="Describe the repair / cleaning completed on site..."
              multiline={true}
              numberOfLines={3}
              style={{ marginTop: 12 }}
            />

            <Button
              title={t('markResolvedBtn')}
              onPress={handleResolveSubmit}
              variant="teal"
              loading={resolving}
              icon={!resolving ? <CheckCircle2 size={16} color={colors.white} /> : null}
            />
          </Card>
        ) : (
          <Card style={styles.resolvedDoneCard}>
            <View style={styles.cardHeaderRow}>
              <CheckCircle2 size={20} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: colors.success, marginBottom: 0 }]}>
                Verified Resolution Recorded
              </Text>
            </View>
            <Text style={styles.descText}>{complaint.resolution_note}</Text>
            {complaint.resolution_photo_url && (
              <Image
                source={{ uri: getMediaUrl(complaint.resolution_photo_url) }}
                style={[styles.evidenceImg, { marginTop: 10 }]}
                resizeMode="cover"
              />
            )}
          </Card>
        )}

        {/* Audit Trail */}
        {complaint.logs && complaint.logs.length > 0 && (
          <Card>
            <View style={styles.cardHeaderRow}>
              <History size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                {t('auditHistoryTitle')}
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 12 }}>
              {complaint.logs.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <View style={styles.logTop}>
                    <Text style={styles.logAction}>{log.action}</Text>
                    <Text style={styles.logTime}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </Text>
                  </View>
                  <Text style={styles.logActor}>
                    {log.actor_name} ({log.actor_role})
                  </Text>
                  {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
                </View>
              ))}
            </View>
          </Card>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate400,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descText: {
    fontSize: 14,
    color: colors.slate800,
    lineHeight: 20,
    marginBottom: 10,
  },
  dupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  dupBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    padding: 10,
    borderRadius: 10,
  },
  mapBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  evidenceImg: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.slate200,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 12,
    lineHeight: 17,
  },
  officerList: {
    gap: 8,
    marginBottom: 14,
  },
  officerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  officerOptionActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tealLight,
  },
  officerOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate900,
  },
  officerOptionDept: {
    fontSize: 11,
    color: colors.slate500,
    marginTop: 2,
  },
  statusOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.slate100,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
  },
  statusChipTextActive: {
    color: colors.white,
  },
  resolveCard: {
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
  },
  resolvedDoneCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  photoBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    height: 74,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate700,
  },
  photoPreviewBox: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 8,
    gap: 6,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  logItem: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  logAction: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  logTime: {
    fontSize: 10,
    color: colors.slate400,
  },
  logActor: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.tealDark,
    marginBottom: 3,
  },
  logNote: {
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 16,
  },
});

export default OfficerComplaintDetailScreen;

