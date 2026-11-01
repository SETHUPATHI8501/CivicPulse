import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export const PriorityBadge = ({ priority }) => {
  const norm = String(priority || '').toUpperCase();

  let label = norm;
  let bg = colors.slate100;
  let text = colors.slate700;

  switch (norm) {
    case 'CRITICAL':
      label = 'Critical';
      bg = '#FEE2E2';
      text = '#DC2626';
      break;
    case 'HIGH':
      label = 'High';
      bg = '#FFEDD5';
      text = '#C2410C';
      break;
    case 'MEDIUM':
      label = 'Medium';
      bg = '#FEF3C7';
      text = '#D97706';
      break;
    case 'LOW':
      label = 'Low';
      bg = '#F1F5F9';
      text = '#475569';
      break;
    default:
      label = priority || 'Normal';
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

export default PriorityBadge;

