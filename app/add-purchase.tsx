import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePortfolio, GoldPurchase } from "@/context/PortfolioContext";
import { TROY_OUNCE_GRAMS } from "@/context/GoldPriceContext";
import { fetchGoldPriceOnDate } from "@/lib/marketData";
import { scanGoldImage } from "@/lib/goldVision";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type GoldType = "bar" | "coin";

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  prefix?: string;
  suffix?: string;
}) {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.inputAdorn}>{prefix}</Text> : null}
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark.textTertiary}
          keyboardType={keyboardType}
          returnKeyType="done"
        />
        {suffix ? <Text style={styles.inputAdornRight}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function AddPurchaseScreen() {
  const insets = useSafeAreaInsets();
  const { addPurchase } = usePortfolio();

  const [type, setType] = useState<GoldType>("bar");
  const [name, setName] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    cost: number;
    pricePerOz: number;
    date: string;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  // Once the user types a price or picks a date by hand, stop auto-filling it
  const priceEdited = useRef(false);
  const priceAutoFilled = useRef(false);
  const dateEdited = useRef(false);

  const handlePriceChange = (v: string) => {
    priceEdited.current = true;
    priceAutoFilled.current = false;
    setPricePaid(v);
  };

  // Photo metadata → purchase date (when the user hasn't chosen one)
  const applyExifDate = (asset: ImagePicker.ImagePickerAsset) => {
    if (dateEdited.current) return;
    const exif: any = asset.exif ?? {};
    const raw =
      exif.DateTimeOriginal ??
      exif["{Exif}"]?.DateTimeOriginal ??
      exif.DateTimeDigitized ??
      exif.DateTime ??
      exif["{TIFF}"]?.DateTime;
    if (typeof raw !== "string") return;
    const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
    if (!m) return;
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    const ms = new Date(`${iso}T12:00:00Z`).getTime();
    if (isNaN(ms) || ms > Date.now() + 86400_000) return;
    setPurchaseDate(iso);
  };

  // Read the stamps on the photographed bar/coin (on-device OCR) and
  // prefill whatever the user hasn't typed yet — they review before saving.
  const scanImage = async (uri: string) => {
    setScanning(true);
    setScanSummary(null);
    const result = await scanGoldImage(uri);
    setScanning(false);
    if (!result) return;

    const filled: string[] = [];
    if (result.type) {
      setType(result.type);
    }
    if (result.name) {
      setName((prev) => {
        if (prev.trim()) return prev;
        filled.push(result.name!);
        return result.name!;
      });
    }
    if (result.weightGrams) {
      setWeightGrams((prev) => {
        if (prev.trim()) return prev;
        filled.push(`${result.weightGrams}g`);
        return String(result.weightGrams);
      });
    }
    if (filled.length || result.type) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScanSummary(
        result.name
          ? `Recognized: ${result.name}${result.purity ? ` · ${result.purity} fine` : ""}`
          : "Details recognized from your photo"
      );
    }
  };

  // Look up the real gold price on the purchase date and suggest the
  // market cost for the entered weight.
  useEffect(() => {
    setEstimate(null);
    const weight = parseFloat(weightGrams);
    if (!DATE_RE.test(purchaseDate) || !weight || weight <= 0) return;
    const dateMs = new Date(`${purchaseDate}T12:00:00Z`).getTime();
    if (isNaN(dateMs) || dateMs > Date.now() + 86400_000) return;

    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(() => {
      fetchGoldPriceOnDate("XAUUSD=X", dateMs)
        .then((pricePerOz) => {
          if (cancelled || !pricePerOz) return;
          const cost = (weight / TROY_OUNCE_GRAMS) * pricePerOz;
          setEstimate({ cost, pricePerOz, date: purchaseDate });
          // Auto-fill unless the user typed their own price
          setPricePaid((prev) => {
            if (priceEdited.current && prev.trim()) return prev;
            priceAutoFilled.current = true;
            return cost.toFixed(2);
          });
        })
        .finally(() => {
          if (!cancelled) setEstimating(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [purchaseDate, weightGrams]);

  const applyEstimate = () => {
    if (!estimate) return;
    Haptics.selectionAsync();
    priceEdited.current = false;
    priceAutoFilled.current = true;
    setPricePaid(estimate.cost.toFixed(2));
  };

  const openDatePicker = () => {
    Haptics.selectionAsync();
    const parsed = new Date(`${purchaseDate}T12:00:00`);
    setPickerDate(isNaN(parsed.getTime()) ? new Date() : parsed);
    setShowDatePicker(true);
  };

  const confirmDate = () => {
    dateEdited.current = true;
    const y = pickerDate.getFullYear();
    const mo = String(pickerDate.getMonth() + 1).padStart(2, "0");
    const da = String(pickerDate.getDate()).padStart(2, "0");
    setPurchaseDate(`${y}-${mo}-${da}`);
    setShowDatePicker(false);
  };

  const formattedPurchaseDate = DATE_RE.test(purchaseDate)
    ? new Date(`${purchaseDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : purchaseDate;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      const galleryStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryStatus.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow camera or photo library access in your settings."
        );
        return;
      }
      const galleryResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: true,
      });
      if (!galleryResult.canceled) {
        setImageUri(galleryResult.assets[0].uri);
        applyExifDate(galleryResult.assets[0]);
        scanImage(galleryResult.assets[0].uri);
      }
      return;
    }

    Alert.alert("Add Photo", "Choose photo source", [
      {
        text: "Take Photo",
        onPress: async () => {
          setImageLoading(true);
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            exif: true,
          });
          setImageLoading(false);
          if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            applyExifDate(result.assets[0]);
            scanImage(result.assets[0].uri);
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            exif: true,
          });
          if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            applyExifDate(result.assets[0]);
            scanImage(result.assets[0].uri);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name for this purchase.");
      return;
    }
    const weight = parseFloat(weightGrams);
    if (!weight || weight <= 0) {
      Alert.alert("Invalid weight", "Please enter a valid weight in grams.");
      return;
    }
    const price = parseFloat(pricePaid);
    if (!price || price < 0) {
      Alert.alert("Invalid price", "Please enter what you paid.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);

    await addPurchase({
      type,
      name: name.trim(),
      weightGrams: weight,
      pricePaid: price,
      purchaseDate,
      imageUri,
      notes: notes.trim() || undefined,
    });

    setIsSaving(false);
    router.back();
  };

  const topPad =
    Platform.OS === "web" ? insets.top + 67 : insets.top + 12;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Fixed header — Save stays visible no matter how far you scroll */}
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.modalTitle}>Add Purchase</Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && styles.saveBtnPressed,
            isSaving && styles.saveBtnDisabled,
          ]}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.dark.background} size="small" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 8,
            paddingBottom: Platform.OS === "web"
              ? insets.bottom + 34
              : insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoSection}>
          <Pressable
            style={({ pressed }) => [
              styles.photoButton,
              pressed && { opacity: 0.75 },
            ]}
            onPress={handlePickImage}
          >
            {imageLoading ? (
              <ActivityIndicator color={Colors.dark.gold} />
            ) : imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                <View style={styles.photoEditBadge}>
                  <Feather name="camera" size={12} color={Colors.dark.background} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.photoIcon}>
                  <Feather name="camera" size={28} color={Colors.dark.gold} />
                </View>
                <Text style={styles.photoHint}>Tap to photograph</Text>
                <Text style={styles.photoSubhint}>your bar or coin</Text>
              </>
            )}
          </Pressable>
          {scanning ? (
            <View style={styles.scanBanner}>
              <ActivityIndicator size="small" color={Colors.dark.gold} />
              <Text style={styles.scanText}>Reading your gold’s stamps…</Text>
            </View>
          ) : scanSummary ? (
            <View style={styles.scanBanner}>
              <Feather name="zap" size={13} color={Colors.dark.gold} />
              <Text style={styles.scanText}>
                {scanSummary} — review the details below
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.typeSection}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.typeRow}>
            {(["bar", "coin"] as GoldType[]).map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.typeBtn,
                  type === t && styles.typeBtnSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setType(t);
                }}
              >
                <Feather
                  name={t === "bar" ? "layers" : "disc"}
                  size={16}
                  color={type === t ? Colors.dark.background : Colors.dark.textSecondary}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    type === t && styles.typeBtnTextSelected,
                  ]}
                >
                  {t === "bar" ? "Gold Bar" : "Gold Coin"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <InputField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={
              type === "bar"
                ? "e.g. PAMP Suisse 1oz Bar"
                : "e.g. American Gold Eagle 1oz"
            }
          />
          <InputField
            label="Weight"
            value={weightGrams}
            onChangeText={setWeightGrams}
            placeholder="31.10"
            keyboardType="decimal-pad"
            suffix="grams"
          />
          <InputField
            label="Price Paid"
            value={pricePaid}
            onChangeText={handlePriceChange}
            placeholder="3,150.00"
            keyboardType="decimal-pad"
            prefix="$"
          />
          {estimating ? (
            <View style={styles.estimateChip}>
              <ActivityIndicator size="small" color={Colors.dark.gold} />
              <Text style={styles.estimateText}>
                Looking up the gold price on that date…
              </Text>
            </View>
          ) : estimate ? (
            <Pressable
              onPress={applyEstimate}
              style={({ pressed }) => [
                styles.estimateChip,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="clock" size={14} color={Colors.dark.gold} />
              <Text style={styles.estimateText}>
                Market value on {estimate.date}: $
                {estimate.cost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                (${estimate.pricePerOz.toLocaleString("en-US")}/oz)
              </Text>
              <Text style={styles.estimateUse}>
                {priceAutoFilled.current ? "Applied" : "Use"}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Purchase Date</Text>
            <Pressable
              style={({ pressed }) => [
                styles.inputRow,
                pressed && { opacity: 0.75 },
              ]}
              onPress={openDatePicker}
            >
              <Text style={styles.dateValue}>{formattedPurchaseDate}</Text>
              <Feather name="calendar" size={16} color={Colors.dark.gold} />
            </Pressable>
          </View>
          <InputField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Bought from local dealer"
          />
        </View>
      </ScrollView>

      {/* System date picker */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setShowDatePicker(false)}
        />
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowDatePicker(false)} hitSlop={10}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Purchase Date</Text>
            <Pressable onPress={confirmDate} hitSlop={10}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            themeVariant="dark"
            maximumDate={new Date()}
            onChange={(_e, d) => {
              if (d) setPickerDate(d);
              if (Platform.OS !== "ios") {
                setShowDatePicker(false);
                if (d) {
                  dateEdited.current = true;
                  const y = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, "0");
                  const da = String(d.getDate()).padStart(2, "0");
                  setPurchaseDate(`${y}-${mo}-${da}`);
                }
              }
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.dark.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  dateValue: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pickerSheet: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 6,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  pickerCancel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  pickerDone: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  saveBtn: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnPressed: {
    opacity: 0.8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.background,
  },
  photoSection: {
    alignItems: "center",
    gap: 10,
  },
  scanBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 320,
  },
  scanText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
    lineHeight: 17,
  },
  photoButton: {
    width: 140,
    height: 140,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 16,
  },
  photoEditBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: Colors.dark.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.goldFaint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  photoHint: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  photoSubhint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  typeSection: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeBtnSelected: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  typeBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  typeBtnTextSelected: {
    color: Colors.dark.background,
  },
  form: {
    gap: 16,
  },
  estimateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.goldFaint,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -6,
  },
  estimateText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
    lineHeight: 17,
  },
  estimateUse: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.gold,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputAdorn: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginRight: 4,
  },
  inputAdornRight: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    height: "100%",
  },
});
