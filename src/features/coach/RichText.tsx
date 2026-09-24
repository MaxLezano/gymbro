import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../core/theme';
import { AppText } from '../../components/ui';

/** Renders **bold** spans inside a line. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={index} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Text key={index}>{part.replace(/\*/g, '')}</Text>
        )
      )}
    </>
  );
}

/**
 * Minimal Markdown renderer for coach answers: paragraphs, headings (#),
 * bullet (- / * / •) and numbered lists, and **bold**. No dependency needed.
 */
export const RichText = React.memo(function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      nodes.push(<View key={`s${index}`} style={styles.spacer} />);
      return;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      nodes.push(
        <AppText key={index} variant="callout" style={styles.heading}>
          <Inline text={heading[1]} />
        </AppText>
      );
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      nodes.push(
        <View key={index} style={styles.listItem}>
          <AppText variant="body" color="primary" style={styles.marker}>
            {numbered ? `${numbered[1]}.` : '•'}
          </AppText>
          <AppText variant="body" style={styles.flex}>
            <Inline text={(bullet?.[1] ?? numbered?.[2]) as string} />
          </AppText>
        </View>
      );
      return;
    }
    nodes.push(
      <AppText key={index} variant="body">
        <Inline text={line} />
      </AppText>
    );
  });

  return <View style={styles.container}>{nodes}</View>;
});

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  spacer: {
    height: 4,
  },
  bold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  heading: {
    fontWeight: '800',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 2,
  },
  marker: {
    minWidth: 14,
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
});
