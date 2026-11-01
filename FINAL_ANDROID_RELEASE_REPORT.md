# CivicPulse AI — Final Android Release & Verification Report

**Project:** CivicPulse AI — Smart Civic Complaint Management Platform  
**Team:** Alronclad | **Institution:** KSR Institute of Engineering and Technology  
**Date:** November 1, 2026

---

## 1. Release Build Metadata

| Property | Value |
| :--- | :--- |
| **Application Name** | `CivicPulse AI` |
| **Expo Slug / EAS Project** | `@thirumuruganp/civicpulse-mobile` (`e66e053f-e564-470d-8247-9c0d98ae9b86`) |
| **Android Application ID (`package`)** | `gov.civicpulse.ai` |
| **App Version / Version Code** | `1.0.0` (`versionCode: 1`) |
| **Expo SDK Version** | `52.0.0` (`52.0.49`, React Native `0.76.9`, React `18.3.1`, Kotlin `1.9.25`) |
| **EAS Build Profile** | `preview` (`"distribution": "internal"`, `"android": { "buildType": "apk" }`) |
| **Successful EAS Build ID** | **`a073ea3a-ecbf-407e-b6c2-559b6a562933`** |
| **EAS Cloud APK Build Status** | **`FINISHED` (SUCCESS)** |
| **Direct APK Download URL** | https://expo.dev/artifacts/eas/J5GBrCCwLfd-liIobmKK42LSoraHlg0qkwc91glvCoc.apk |
| **EAS Build Dashboard URL** | https://expo.dev/accounts/thirumuruganp/projects/civicpulse-mobile/builds/a073ea3a-ecbf-407e-b6c2-559b6a562933 |
| **Android Cleartext HTTP Support** | `usesCleartextTraffic: true` + `kotlinVersion: "1.9.25"` via `expo-build-properties` |

---

## 2. Root-Cause Diagnosis & Fix Applied for Initial Build

- **Initial Failed Build (`d6960241-778f-44b9-8c30-fbde17e16ec2`):** Failed in `:expo-modules-core:compileReleaseKotlin` because `react-native@0.76.6` used Kotlin `1.9.24` while `expo@52.0.49` Compose Compiler `1.5.15` required Kotlin `1.9.25`.
- **Fix Applied:** Upgraded `react-native` to `0.76.9` in `mobile/package.json` and configured `expo-build-properties` (`kotlinVersion: "1.9.25"`, `usesCleartextTraffic: true`) in `mobile/app.json`.
- **Retry Build (`a073ea3a-ecbf-407e-b6c2-559b6a562933`):** Completed with status **`FINISHED`** in `427s`, producing the signed installable Android `.apk`.

---

## 3. Production & Hackathon LAN API Configuration

- **`EXPO_PUBLIC_API_URL`**: `http://10.46.101.115:8000/api/v1`
- **In-App Runtime LAN IP Switcher**: Included in `mobile/src/services/api.js` and `mobile/src/components/LoadingView.js` (`Configure Backend LAN URL`) so you can dynamically update the backend IP on the phone without rebuilding the APK if the hackathon Wi-Fi IP changes.
- **Verified Live Submission from App**: Complaint `#93` (`CP-77B36589`, `"issue (Landmark: karur)"`) was submitted and recorded in `civicpulse.db` at `2026-10-31 21:57:09 UTC`.
