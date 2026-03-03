import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const MOBILE_PRIORITIES = [
  "Daily call sheets and crew updates on set",
  "Quick scene/schedule checks while moving between locations",
  "Production assistant chat optimized for small screens",
];

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ProdAI Mobile</Text>
        <Text style={styles.title}>Production control from your phone</Text>
        <Text style={styles.description}>
          This app is scaffolded as a dedicated workspace in the monorepo and
          is ready for feature-by-feature parity work with the web platform.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Initial Scope</Text>
          {MOBILE_PRIORITIES.map((item) => (
            <Text key={item} style={styles.listItem}>
              - {item}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F4EE",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 14,
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
    fontSize: 12,
    color: "#6B5A3C",
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    color: "#1F2937",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
  },
  card: {
    marginTop: 10,
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  listItem: {
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
});
