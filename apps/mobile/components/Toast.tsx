import { colors, radius, shadow } from "@/theme/tokens";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

export type ToastType = "success" | "error" | "info";

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ notify: (message: string, type?: ToastType) => void }>({
  notify: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

const DURATION = 3500;

/** Avisos breves no bloqueantes (éxito/error) tras cada acción. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  const notify = useCallback(
    (message: string, type: ToastType = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, type }));
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => dismiss(), DURATION);
    },
    [dismiss, opacity],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const style =
    toast?.type === "success"
      ? styles.success
      : toast?.type === "error"
        ? styles.error
        : styles.info;

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toast ? (
        <View style={styles.host} pointerEvents="box-none">
          <Animated.View style={[styles.card, style, { opacity }]}>
            <Text style={styles.dot}>●</Text>
            <Text style={styles.text} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {toast.message}
            </Text>
            <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Descartar" hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadow.card,
  },
  success: { backgroundColor: colors.success },
  error: { backgroundColor: colors.error },
  info: { backgroundColor: colors.primary },
  dot: { color: colors.white, fontSize: 10 },
  text: { flex: 1, color: colors.white, fontSize: 14, fontWeight: "600" },
  close: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
