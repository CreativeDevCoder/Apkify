// Aplikasi iOS yang dibuat Apkify: SwiftUI + WKWebView.
import SwiftUI

@main
struct ApkifyApp: SwiftUI.App {
    var body: some Scene {
        WindowGroup {
            ZStack {
                Color(hex: AppConfig.shared.statusBar).ignoresSafeArea()
                WebView().ignoresSafeArea(edges: AppConfig.shared.fullscreen ? .all : .bottom)
            }
            .statusBarHidden(AppConfig.shared.fullscreen)
        }
    }
}

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}
