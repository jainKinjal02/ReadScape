import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../design/tokens";
import { toUserMessage } from "../lib/errors";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below it.
 *
 * Without this, one thrown error unmounts the whole tree and the reader is
 * left looking at a blank screen with no way back — which is worse than any
 * message we could show. Error boundaries have to be class components; there
 * is no hook equivalent.
 *
 * Note this does NOT catch errors inside event handlers or promises. Those
 * still need their own try/catch at the call site.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Left as console.error on purpose: it survives into release builds and is
    // where crash reporting hooks in later.
    console.error("Unhandled render error:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{toUserMessage(error)}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setState({ error: null })}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          If this keeps happening, closing and reopening ReadScape usually clears it.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    gap: 10,
  },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.pencil,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 12,
    backgroundColor: colors.ink,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.paper },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.pencil2,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 17,
  },
});
