import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, radius, size, space } from '../theme';
import { useType } from './typeContext';

export const FIELD_HEIGHT = size.control;

export function Field({ label, nativeID, style, ...input }: TextInputProps & { label: string; nativeID: string }) {
  const type = useType();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[type.caption, styles.fieldLabel]} nativeID={nativeID}>
        {label}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityLabelledBy={nativeID}
        placeholderTextColor={colors.graphite}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[type.body, styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space(8), marginBottom: space(4) },
  fieldLabel: { color: colors.graphite },
  input: {
    height: FIELD_HEIGHT,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    paddingHorizontal: space(16),
    paddingVertical: 0,
  },
  inputFocused: { borderColor: colors.ink },
});
