import React, { useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePortfolio, GoldPurchase } from "@/context/PortfolioContext";

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
      });
      if (!galleryResult.canceled) {
        setImageUri(galleryResult.assets[0].uri);
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
          });
          setImageLoading(false);
          if (!result.canceled) {
            setImageUri(result.assets[0].uri);
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
          });
          if (!result.canceled) {
            setImageUri(result.assets[0].uri);
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topPad,
            paddingBottom: Platform.OS === "web"
              ? insets.bottom + 34
              : insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
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
            onChangeText={setPricePaid}
            placeholder="3,150.00"
            keyboardType="decimal-pad"
            prefix="$"
          />
          <InputField
            label="Purchase Date"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="YYYY-MM-DD"
          />
          <InputField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Bought from local dealer"
          />
        </View>
      </ScrollView>
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
