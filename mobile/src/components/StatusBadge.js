import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export const StatusBadge = ({ status }) => {
  const norm = String(status || '').toUpperCase();

  let label = norm;
  let bg = colors.slate100;
  let text = colors.slate700;

  switch (norm) {
    case 'OPEN':
      label = 'Open';
      bg = '#FEF3C7';
      text = '#B45309';
      break;
    case 'ASSIGNED':
      label = 'Assigned';
      bg = '#E0F2FE';
      text = '#0369A1';
      break;
    case 'IN_PROGRESS':
      label = 'In Progress';
      bg = '#DBEAFE';
      text = '#1D4ED8';
      break;
    case 'RESOLVED':
      label = 'Resolved';
      bg = '#DCFCE7';
      text = '#15803D';
      break;
    case 'NEEDS_INFO':
      label = 'Needs Info';
      bg = '#F3E8FF';
      text = '#7E22CE';
      break;
    case 'REJECTED':
      label = 'Rejected';
      bg = '#FEE2E2';
      text = '#B91C1C';
      break;
    default:
      label = status || 'Unknown';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

export default StatusBadge;

