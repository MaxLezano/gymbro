import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextStyle } from 'react-native';
import { theme } from '../../core/theme';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  decimals?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<TextStyle>;
  completed?: boolean;
  autoFocus?: boolean;
}

const format = (value: number) => (value === 0 ? '' : String(value));

/**
 * Numeric field that keeps its own text (so "62." or an empty field survive
 * while typing) and resyncs when the value changes from outside (fill-down).
 */
export const NumberInput = React.memo(function NumberInput({
  value,
  onChange,
  decimals = false,
  accessibilityLabel,
  style,
  completed,
  autoFocus,
}: NumberInputProps) {
  const [text, setText] = useState(format(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    const parsedText = decimals ? parseFloat(text.replace(',', '.')) || 0 : parseInt(text, 10) || 0;
    if (parsedText !== value) setText(format(value));
  }

  const handleChange = (raw: string) => {
    const cleaned = decimals ? raw.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : raw.replace(/\D/g, '');
    setText(cleaned);
    const parsed = decimals ? parseFloat(cleaned) || 0 : parseInt(cleaned, 10) || 0;
    const bounded = Math.min(decimals ? 999 : 999, parsed);
    setLastValue(bounded);
    onChange(bounded);
  };

  return (
    <TextInput
      value={text}
      onChangeText={handleChange}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      placeholder="0"
      placeholderTextColor={theme.colors.textDisabled}
      selectTextOnFocus
      autoFocus={autoFocus}
      maxLength={decimals ? 5 : 3}
      selectionColor={theme.colors.primary}
      accessibilityLabel={accessibilityLabel}
      style={[styles.input, completed && styles.completed, style]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  completed: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: theme.colors.success,
  },
});
