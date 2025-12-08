import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { supabase } from "../lib/supabase";

type Nav = NativeStackNavigationProp<RootStackParamList, "Profile">;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();

  const [name, setName] = useState("");
  const [lNamePat, setLNamePat] = useState("");
  const [lNameMat, setLNameMat] = useState("");
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [workProf, setWorkProf] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const [country, setCountry] = useState("");
  const [stateMx, setStateMx] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const birthdateLabel = useMemo(() => {
    if (!birthdate) return "Seleccionar fecha";
    return birthdate.toLocaleDateString();
  }, [birthdate]);

  const onPickDate = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) setBirthdate(selected);
  };

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso requerido",
        "Se necesita permiso para acceder a la galería de fotos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    console.log("ImagePicker result:", result); // Debug
    if (
      result.canceled ||
      result.assets[0] === null ||
      result.assets[0] === undefined
    )
      return;

    const arraybuffer = await fetch(result.assets[0].uri).then((res) =>
      res.arrayBuffer()
    );
    const fileExt =
      result.assets[0].uri?.split(".").pop()?.toLowerCase() ?? "jpeg";
    const path = `${Date.now()}.${fileExt}`;

    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, arraybuffer);
    console.log("Upload result:", { data, uploadError }); // Debug
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    setProfilePic(urlData.publicUrl);
  };

  async function loadProfile() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      if (!user) {
        console.log("No hay usuario autenticado");
        return;
      }

      console.log("User ID:", user.id); // Debug

      const { data, error } = await supabase
        .from("person")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log("loadProfile error:", error.message);
        return;
      }

      if (data) {
        console.log("Datos cargados"); // Debug
        setName(data.name ?? "");
        setLNamePat(data.l_name_pat ?? "");
        setLNameMat(data.l_name_mat ?? "");
        setBirthdate(data.birthdate ? new Date(data.birthdate) : undefined);
        setProfilePic(data.profile_pic ?? null);
        setWorkProf(data.work_prof ?? "");

        setCountry(data.country ?? "");
        setStateMx(data.state ?? "");
        setCity(data.city ?? "");
        setNeighborhood(data.neighborhood ?? "");
        setStreet(data.street ?? "");
      } else {
        console.log("No se encontró perfil para este usuario");
      }
    } catch (e: any) {
      console.log("loadProfile exception:", e?.message ?? e);
    }
  }

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Falta tu nombre", "Por favor ingresa tu nombre.");
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        Alert.alert("Error", "No hay sesión activa.");
        return;
      }

      console.log("Guardando con user_id:", user.id); // Debug

      // Formatear fecha
      let formattedDate = null;
      if (birthdate) {
        const year = birthdate.getFullYear();
        const month = String(birthdate.getMonth() + 1).padStart(2, "0");
        const day = String(birthdate.getDate()).padStart(2, "0");
        formattedDate = `${year}-${month}-${day}`;
      }

      //Generación de "embedding" que es la informacion para el match con IA es AQUÍ
      const textoParaVectorizar = workProf.trim();

      console.log("1. Generando embedding...");
      const { data: embeddingData, error: iaError } =
        await supabase.functions.invoke("generate_embedding", {
          body: { text: textoParaVectorizar },
        });

      if (iaError) throw iaError;
      const embeddingVector = embeddingData.embedding;

      const updateData = {
        name: name.trim(),
        l_name_pat: lNamePat.trim(),
        l_name_mat: lNameMat.trim(),
        birthdate: formattedDate,
        profile_pic: profilePic,
        work_prof: workProf.trim(),
        country: country.trim(),
        state: stateMx.trim(),
        city: city.trim(),
        area: neighborhood.trim(),
        street: street.trim(),
        embedding: embeddingVector,
      };


      const { error } = await supabase
        .from("person")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) {
        console.log("Error al actualizar información:", error);
        Alert.alert(
          "Error",
          "No se pudo guardar la información: " + error.message
        );
        return;
      }

      // Handle password change if any password field is filled
      if (currentPassword || newPassword || confirmPassword) {
        // Basic validations
        if (!currentPassword) {
          Alert.alert(
            "Falta contraseña actual",
            "Por favor ingresa tu contraseña actual para cambiarla."
          );
          return;
        }
        if (!newPassword) {
          Alert.alert(
            "Falta nueva contraseña",
            "Por favor ingresa la nueva contraseña."
          );
          return;
        }
        if (newPassword !== confirmPassword) {
          Alert.alert(
            "Contraseñas no coinciden",
            "La nueva contraseña y su confirmación no coinciden."
          );
          return;
        }
        if (!user.email) {
          Alert.alert(
            "Error",
            "No se pudo obtener el correo del usuario para verificar la contraseña."
          );
          return;
        }

        // Re-authenticate to verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          console.log("Re-authentication failed:", signInError);
          Alert.alert("Error", "La contraseña actual es incorrecta.");
          return;
        }

        // Update password
        const { error: updatePwdError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updatePwdError) {
          console.log("Password update error:", updatePwdError);
          Alert.alert(
            "Error",
            "No se pudo actualizar la contraseña: " + updatePwdError.message
          );
          return;
        }
        // Clear password fields on success
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      Alert.alert("Éxito", "Perfil actualizado correctamente.");
    } catch (e: any) {
      console.log("onSave exception:", e?.message ?? e);
      Alert.alert("Error", "Ocurrió un error al guardar.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#0A3251" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto de perfil</Text>
          <View style={styles.avatarRow}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={36} color="#0A3251" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onPickAvatar}
            >
              <Ionicons name="camera" size={18} color="#0A3251" />
              <Text style={[styles.btnText, styles.btnTextSecondary]}>
                Cambiar foto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos personales</Text>

          <Field label="Nombre(s)">
            <TextInput
              placeholder="Tu nombre"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Apellido paterno">
            <TextInput
              placeholder="Paterno"
              value={lNamePat}
              onChangeText={setLNamePat}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Apellido materno">
            <TextInput
              placeholder="Materno"
              value={lNameMat}
              onChangeText={setLNameMat}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Fecha de nacimiento">
            <TouchableOpacity
              style={[styles.input, styles.inputButton]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={18} color="#0A3251" />
              <Text
                style={
                  birthdate
                    ? styles.inputButtonText
                    : styles.inputButtonPlaceholder
                }
              >
                {birthdateLabel}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                value={birthdate ?? new Date(2000, 0, 1)}
                onChange={onPickDate}
                maximumDate={new Date()}
              />
            )}
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Domicilio</Text>

          <Field label="País">
            <TextInput
              placeholder="México"
              value={country}
              onChangeText={setCountry}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Estado">
            <TextInput
              placeholder="Michoacán"
              value={stateMx}
              onChangeText={setStateMx}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Ciudad">
            <TextInput
              placeholder="Morelia"
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Colonia">
            <TextInput
              placeholder="Colonia"
              value={neighborhood}
              onChangeText={setNeighborhood}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Calle">
            <TextInput
              placeholder="Calle"
              value={street}
              onChangeText={setStreet}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Colaboración</Text>
          <Field label="Colaborando actualmente en: ">
            <TextInput
              placeholder="Ing. en Sistemas, Carpintero, etc."
              value={workProf}
              onChangeText={setWorkProf}
              style={styles.interestsInput}
              placeholderTextColor="#8FA1B3"
              multiline
              textAlignVertical="top"
            />
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seguridad</Text>

          <Field label="Contraseña actual">
            <TextInput
              placeholder="••••••••"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Nueva contraseña">
            <TextInput
              placeholder="••••••••"
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Confirmar nueva contraseña">
            <TextInput
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>
        </View>

        <View style={{ height: 88 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={onSave}
        >
          <Ionicons name="save" size={18} color="#fff" />
          <Text style={[styles.btnText, styles.btnTextPrimary]}>
            Guardar cambios
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E9EE",
  },
  headerTitle: { color: "#0A3251", fontSize: 18, fontWeight: "700" },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 8,
  },
  cardTitle: { color: "#0A3251", fontWeight: "700", marginBottom: 6 },
  field: { marginBottom: 10 },
  label: { color: "#5A6B7C", marginBottom: 6, fontSize: 13 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#C7D1DF",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#0A3251",
    backgroundColor: "#F8FAFC",
  },
  interestsInput: {
    marginTop: 10,
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7D1DF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    fontSize: 13,
    color: "#0A3251",
  },
  inputButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputButtonText: { color: "#0A3251" },
  inputButtonPlaceholder: { color: "#8FA1B3" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D7ECFF",
  },
  btn: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimary: { backgroundColor: "#0A3251" },
  btnTextPrimary: { color: "#fff" },
  btnSecondary: {
    backgroundColor: "#F2F5F8",
    borderWidth: 1,
    borderColor: "#C7D1DF",
  },
  btnTextSecondary: { color: "#0A3251" },
  btnText: { fontWeight: "700" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 16,
  },
});
