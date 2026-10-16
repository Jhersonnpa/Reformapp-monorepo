import { useEffect, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ViewerPhoto {
  uri: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(v: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, v));
}

function ZoomableImage({ uri, active }: { uri: string; active: boolean }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);

  // Al salir de la foto, vuelve a 1x para no arrastrar zoom entre páginas.
  useEffect(() => {
    if (!active && scale.value !== 1) {
      scale.value = withTiming(1);
      saved.value = 1;
    }
  }, [active, scale, saved]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(saved.value * e.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      saved.value = scale.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.5 ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      saved.value = next;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.page}>
      <GestureDetector gesture={Gesture.Exclusive(doubleTap, pinch)}>
        <Animated.View style={[styles.zoomBox, style]}>
          <Animated.Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityRole="image"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * Visor a pantalla completa: swipe entre fotos, pellizco o doble
 * toque para zoom, contador y cierre. Vale para URLs remotas
 * (R2 presignadas) y ficheros locales pendientes de subir.
 */
export function PhotoViewer({
  photos,
  index,
  visible,
  onClose,
}: {
  photos: ViewerPhoto[];
  index: number;
  visible: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    if (visible) setCurrent(index);
  }, [visible, index]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar visor"
            hitSlop={12}
            style={styles.close}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.counter}>
            {photos.length > 0 ? `${current + 1} / ${photos.length}` : ""}
          </Text>
          <View style={styles.spacer} />
        </View>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p, i) => `${p.uri}-${i}`}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrent(i);
          }}
          renderItem={({ item, index: i }) => (
            <ZoomableImage uri={item.uri} active={i === current} />
          )}
        />
        <Text style={styles.hint}>Pellizca o toca dos veces para ampliar</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "white", fontSize: 18, fontWeight: "700" },
  counter: { flex: 1, textAlign: "center", color: "white", fontSize: 15, fontWeight: "600" },
  spacer: { width: 44 },
  page: { width: SCREEN_W, height: SCREEN_H - 180, alignItems: "center", justifyContent: "center" },
  zoomBox: { width: SCREEN_W, height: "100%", alignItems: "center", justifyContent: "center" },
  image: { width: SCREEN_W, height: "100%" },
  hint: { textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12, paddingBottom: 32 },
});
