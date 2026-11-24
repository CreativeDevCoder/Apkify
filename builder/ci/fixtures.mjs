// Fixture konfigurasi untuk CI: memastikan template Android ter-compile untuk setiap kombinasi modul & jaringan iklan.
const base = (over) => ({
  name: 'Apkify CI', packageName: 'app.apkify.ci', versionName: '1.0.0', iconFileId: 'icon',
  source: { type: 'url', url: 'https://example.com' }, colors: { primary: '#4f46e5' }, ...over
});

const ALL = Object.fromEntries(['jsApi', 'pullToRefresh', 'fileUpload', 'downloads', 'geolocation', 'camera', 'microphone', 'qrScanner', 'biometric',
  'inAppReview', 'billing', 'nativeStorage', 'shareTarget', 'shortcuts', 'analytics', 'bottomNav', 'fab', 'sideMenu', 'showToolbar', 'deepLinking',
  'sensors', 'infrared', 'nfc', 'nfcHce', 'bluetooth', 'usb', 'nativeCamera', 'docScanner', 'ocr', 'faceDetection', 'qrGenerate',
  'locationApi', 'geofence', 'activityRecognition', 'localNotifications', 'backgroundSync', 'autoStart', 'backgroundAudio', 'pip', 'cast',
  'tts', 'speech', 'audioRecord', 'print', 'pdfViewer', 'saveGallery', 'contacts', 'contactsRead', 'calendar', 'smsOtp', 'phoneCall', 'directCall',
  'shareFiles', 'fileSystem', 'secureStorage', 'sqlite', 'installReferrer', 'googleSignIn', 'facebookLogin', 'firebaseAnalytics', 'crashlytics',
  'fcm', 'playIntegrity', 'inAppUpdate', 'autoUpdate', 'payments', 'widget', 'quickTile', 'altIcons', 'appLock', 'kiosk', 'barcodeScanner', 'mdm',
  'androidTv', 'ads', 'interstitial'].map((k) => [k, true]));

const nav = { bottomNav: { items: [{ label: 'Home', icon: 'home', url: '/' }, { label: 'Cari', icon: 'search', url: '/search' }] }, fab: { action: 'scan' } };

export const FIXTURES = {
  minimal: base({}),
  full: base({
    features: ALL, ...nav, fcmFileId: 'gs', altIconFileIds: ['alt', 'alt'],
    google: { webClientId: '123-abc.apps.googleusercontent.com' }, facebook: { appId: '1234567890', clientToken: '0123456789abcdef0123456789abcdef' },
    nfc: { aids: ['F0010203040506'] }, kiosk: { launcher: true }, tile: { label: 'Buka', url: '/' }, widget: { title: 'Hai', url: '/' },
    ads: {
      network: 'admob', interstitial: true, appOpen: true, bannerStyle: 'native', mediation: ['meta', 'applovin', 'unity', 'pangle', 'mintegral', 'ironsource'],
      admob: { appId: 'ca-app-pub-3940256099942544~3347511713', bannerId: 'ca-app-pub-3940256099942544/9214589741', interstitialId: 'ca-app-pub-3940256099942544/1033173712',
        rewardedId: 'ca-app-pub-3940256099942544/5224354917', rewardedInterstitialId: 'ca-app-pub-3940256099942544/5354046379',
        appOpenId: 'ca-app-pub-3940256099942544/9257395921', nativeId: 'ca-app-pub-3940256099942544/2247696110' },
      applovin: { sdkKey: 'ci_fake_sdk_key_0123456789abcdef0123456789abcdef0123456789abcdef' }
    }
  }),
  applovin: base({
    source: { type: 'zip', fileId: 'zip' },
    features: { jsApi: true, ads: true, interstitial: true, locationApi: true, docScanner: true, ocr: true, backgroundSync: true },
    ads: { network: 'applovin', appOpen: true, applovin: { sdkKey: 'ci_fake_sdk_key_0123456789abcdef0123456789abcdef0123456789abcdef', bannerId: 'abc123', interstitialId: 'def456', rewardedId: 'ghi789', appOpenId: 'jkl012' } }
  }),
  unity: base({ features: { ads: true, cast: true, googleSignIn: true }, google: { webClientId: '123-abc.apps.googleusercontent.com' },
    ads: { network: 'unity', unity: { gameId: '1234567', bannerId: 'Banner_Android', interstitialId: 'Interstitial_Android', rewardedId: 'Rewarded_Android', testMode: true } } }),
  meta: base({ features: { ads: true, facebookLogin: true }, facebook: { appId: '1234567890', clientToken: '0123456789abcdef0123456789abcdef' },
    ads: { network: 'meta', meta: { bannerId: '123_456', interstitialId: '123_789', rewardedId: '123_000' } } }),
  startio: base({ features: { ads: true, nfc: true, bluetooth: true, usb: true }, ads: { network: 'startio', startio: { appId: '200000000', testMode: true } } })
};
