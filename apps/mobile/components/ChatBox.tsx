import { es } from "@/i18n/es";
import { serverMessage } from "@/services/auth-service";
import { listMessages, sendMessage } from "@/services/requests-service";
import { colors, radius } from "@/theme/tokens";
import type { ChatMessage } from "@reformapp/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Chat del trabajo (cliente <-> técnico asignado).
 * Sin polling: carga al entrar/enfocar + pull-to-refresh + envío local.
 * En DONE es solo lectura (historial).
 */
export function ChatBox({ requestId, readOnly = false }: { requestId: string; readOnly?: boolean }) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { messages } = await listMessages(requestId);
      setItems(messages);
    } catch (e: unknown) {
      setError(serverMessage(e, es.chat.loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const { message } = await sendMessage(requestId, body);
      setItems((prev) => [...prev, message]);
      setDraft("");
    } catch (e: unknown) {
      setError(serverMessage(e, es.chat.sendError));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{es.chat.title}</Text>
      {readOnly ? <Text style={styles.note}>{es.chat.readonly}</Text> : null}
      {loading ? (
        <Text style={styles.muted}>…</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          ListEmptyComponent={<Text style={styles.muted}>{es.chat.empty}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, item.mine ? styles.mineRow : styles.theirsRow]}>
              <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.body, item.mine ? styles.mineText : styles.theirsText]}>
                  {item.body}
                </Text>
                <Text style={[styles.time, item.mine ? styles.mineText : styles.theirsText]}>
                  {new Date(item.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          )}
        />
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {readOnly ? null : (
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={es.chat.placeholder}
            placeholderTextColor="#6E7882"
            multiline
            maxLength={1000}
            accessibilityLabel={es.chat.placeholder}
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            blurOnSubmit={false}
            style={styles.input}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={es.chat.send}
            accessibilityState={{ disabled: !draft.trim() || sending }}
            hitSlop={8}
            style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}
          >
            <Text style={styles.sendText}>{sending ? "…" : "➤"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: colors.primary },
  note: { fontSize: 13, color: colors.muted },
  muted: { fontSize: 14, color: colors.muted },
  list: { gap: 8 },
  row: { flexDirection: "row" },
  mineRow: { justifyContent: "flex-end" },
  theirsRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: "#EEF2F6", borderBottomLeftRadius: 4 },
  body: { fontSize: 15 },
  time: { fontSize: 11, opacity: 0.7, alignSelf: "flex-end" },
  mineText: { color: colors.white },
  theirsText: { color: colors.text },
  error: { fontSize: 13, color: colors.error },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
  sendText: { color: colors.white, fontSize: 18, fontWeight: "700" },
});
