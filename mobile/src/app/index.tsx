import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { getHealth, type HealthStatus } from "@/api/health";
import { getApiBaseUrl } from "@/config/api";
import { colors } from "@/constants/theme";

type BackendState =
  | { kind: "checking" }
  | { kind: "reachable"; status: HealthStatus }
  | { kind: "unreachable"; reason: string };

export default function Index() {
  const [backend, setBackend] = useState<BackendState>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setBackend({ kind: "reachable", status: health.status });
      })
      .catch((error: unknown) => {
        const reason = error instanceof ApiError ? error.message : "Unexpected error";
        if (!cancelled) setBackend({ kind: "unreachable", reason });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const check = () => {
    setBackend({ kind: "checking" });
    setAttempt((n) => n + 1);
  };

  const isUp = backend.kind === "reachable" && backend.status === "UP";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Backend status</Text>

      <View style={styles.card}>
        {backend.kind === "checking" ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <View style={[styles.dot, { backgroundColor: isUp ? colors.accent : colors.danger }]} />
            <Text style={styles.status}>
              {backend.kind === "reachable" ? backend.status : "Unreachable"}
            </Text>
            {backend.kind === "unreachable" && <Text style={styles.muted}>{backend.reason}</Text>}
          </>
        )}
      </View>

      <Text style={styles.muted}>{getApiBaseUrl()}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={check}
        disabled={backend.kind === "checking"}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Check again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  card: {
    alignItems: "center",
    gap: 8,
    minWidth: 220,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  status: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "600",
  },
});
