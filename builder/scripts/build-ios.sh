#!/usr/bin/env bash
# Build iOS di runner macOS: proyek Xcode (selalu) + IPA (bertanda tangan bila sertifikat tersedia, jika tidak: unsigned untuk sideload/re-sign).
set -euo pipefail
cd "$WORK_DIR"
xcodegen generate
OUT="$RUNNER_TEMP/ios-out"; mkdir -p "$OUT"
# Proyek Xcode siap buka (untuk publikasi via Xcode/Transporter)
zip -qry "$OUT/xcode.zip" . -x "build/*"

if [ "${IOS_SIGNED:-0}" = "1" ]; then
  KC="$RUNNER_TEMP/build.keychain-db"; KCP="$(openssl rand -hex 16)"
  security create-keychain -p "$KCP" "$KC"
  security set-keychain-settings -lut 21600 "$KC"
  security unlock-keychain -p "$KCP" "$KC"
  security import "$IOS_P12" -P "$IOS_P12_PASS" -A -t cert -f pkcs12 -k "$KC"
  security set-key-partition-list -S apple-tool:,apple: -k "$KCP" "$KC" >/dev/null
  security list-keychains -d user -s "$KC" $(security list-keychains -d user | tr -d '"')
  UUID=$(security cms -D -i "$IOS_PROFILE" | plutil -extract UUID raw -)
  mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
  cp "$IOS_PROFILE" "$HOME/Library/MobileDevice/Provisioning Profiles/$UUID.mobileprovision"
  xcodebuild -project WebApp.xcodeproj -scheme WebApp -configuration Release -sdk iphoneos \
    -archivePath build/WebApp.xcarchive archive \
    CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$IOS_TEAM" PROVISIONING_PROFILE_SPECIFIER="$UUID" CODE_SIGN_IDENTITY="Apple Distribution" OTHER_CODE_SIGN_FLAGS="--keychain $KC"
  cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>$IOS_METHOD</string>
<key>teamID</key><string>$IOS_TEAM</string>
<key>signingStyle</key><string>manual</string>
<key>provisioningProfiles</key><dict><key>$IOS_BUNDLE</key><string>$UUID</string></dict>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath build/WebApp.xcarchive -exportPath build/export -exportOptionsPlist build/ExportOptions.plist
  cp build/export/*.ipa "$OUT/app.ipa"
  security delete-keychain "$KC" || true
else
  xcodebuild -project WebApp.xcodeproj -scheme WebApp -configuration Release -sdk iphoneos \
    -archivePath build/WebApp.xcarchive archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""
  mkdir -p build/Payload
  cp -R build/WebApp.xcarchive/Products/Applications/WebApp.app build/Payload/
  (cd build && zip -qry "$OUT/app.ipa" Payload)
fi
ls -la "$OUT"
