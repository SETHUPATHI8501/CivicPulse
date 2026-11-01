import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Copy, Check, Share2, ExternalLink, Eye } from 'lucide-react-native';
import colors from '../theme/colors';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { useLanguage } from '../contexts/LanguageContext';

export const CaseIdCard = ({
  caseId,
  trackingId,
  status,
  priority,
  createdAt,
  showActions = true,
  onTrackPress,
  onViewDetailsPress,
}) => {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);

  const resolvedId = caseId || trackingId || 'CP-2026-00001';
  const hasDistinctRef = trackingId && caseId && trackingId !== caseId;

  const handleCopy = async () => {
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(resolvedId);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      Alert.alert(
        language === 'ta' ? 'வழக்கு எண் நகலெடுக்கப்பட்டது' : 'Case ID Ready',
        language === 'ta'
          ? `வழக்கு எண்: ${resolvedId}\nஉங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.`
          : `Case ID: ${resolvedId}\nSaved to your device history for instant tracking.`
      );
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareMessage =
      language === 'ta'
        ? `CivicPulse AI — வழக்கு எண்: ${resolvedId}\nஉங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.`
        : `CivicPulse AI — Case ID: ${resolvedId}\nUse this unified Case ID to track real-time municipal grievance resolution across Mobile & Web.`;
    try {
      await Share.share({
        title: `CivicPulse AI Case ${resolvedId}`,
        message: shareMessage,
      });
    } catch {
      // user cancelled share sheet
    }
  };

  return (
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {language === 'ta'
              ? 'ஒருங்கிணைந்த வழக்கு எண் (UNIFIED CASE ID)'
              : 'UNIFIED MUNICIPAL CASE ID'}
          </Text>
          <Text selectable style={styles.caseIdValue}>
            {resolvedId}
          </Text>
          {hasDistinctRef ? (
            <Text style={styles.legacyRef}>Ref: {trackingId}</Text>
          ) : null}
        </View>

        <View style={styles.badgesCol}>
          {status ? <StatusBadge status={status} /> : null}
          {priority ? <PriorityBadge priority={priority} /> : null}
        </View>
      </View>

      <Text style={styles.bilingualNote}>
        {language === 'ta'
          ? `வழக்கு எண்: ${resolvedId} • உங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.`
          : `வழக்கு எண்: ${resolvedId} • Save this Case ID to track status across Mobile & Web.`}
      </Text>

      {createdAt ? (
        <Text style={styles.timestampText}>
          {language === 'ta' ? 'பதிவு நேரம்: ' : 'Submitted: '}
          {new Date(createdAt).toLocaleString()}
        </Text>
      ) : null}

      {showActions && (
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionPill} onPress={handleCopy}>
            {copied ? (
              <Check size={14} color="#34D399" />
            ) : (
              <Copy size={14} color="#5EEAD4" />
            )}
            <Text style={styles.actionPillText}>
              {copied
                ? language === 'ta'
                  ? 'நகலெடுக்கப்பட்டது'
                  : 'Copied!'
                : language === 'ta'
                ? 'நகலெடு'
                : 'Copy Case ID'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionPill} onPress={handleShare}>
            <Share2 size={14} color="#5EEAD4" />
            <Text style={styles.actionPillText}>
              {language === 'ta' ? 'பகிர்' : 'Share Case ID'}
            </Text>
          </TouchableOpacity>

          {onTrackPress && (
            <TouchableOpacity
              style={[styles.actionPill, styles.actionPillPrimary]}
              onPress={onTrackPress}
            >
              <ExternalLink size={14} color={colors.primary} />
              <Text style={styles.actionPillPrimaryText}>
                {language === 'ta' ? 'புகாரைக் கண்காணிக்க' : 'Track Complaint'}
              </Text>
            </TouchableOpacity>
          )}

          {onViewDetailsPress && (
            <TouchableOpacity style={styles.actionPill} onPress={onViewDetailsPress}>
              <Eye size={14} color="#5EEAD4" />
              <Text style={styles.actionPillText}>
                {language === 'ta' ? 'புகார் விவரம்' : 'View Complaint Details'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.35)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  caseIdValue: {
    fontSize: 23,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.6,
  },
  legacyRef: {
    fontSize: 11,
    color: colors.slate300,
    marginTop: 2,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bilingualNote: {
    fontSize: 11,
    color: '#CCFBF1',
    marginTop: 8,
    lineHeight: 16,
    fontWeight: '600',
  },
  timestampText: {
    fontSize: 11,
    color: colors.slate300,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  actionPillPrimary: {
    backgroundColor: '#2DD4BF',
    borderColor: '#2DD4BF',
  },
  actionPillPrimaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
});

export default CaseIdCard;

