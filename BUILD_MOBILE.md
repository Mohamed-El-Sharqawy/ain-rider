Choose the command based on what type of build you need:-

For Development (Install on your phone or emulator for debugging): npx eas-cli build -p android --profile development

For Preview (Internal testing APK or AAB): npx eas-cli build -p android --profile preview

For Production (Google Play Store release): npx eas-cli build -p android --profile production

🔎 TIP: You are using a build configuration that could benefit from using eas build:dev command. Run it to install and run cached development build, or create a new one if a compatible build doesn't exist yet.