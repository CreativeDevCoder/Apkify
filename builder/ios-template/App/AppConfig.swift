import Foundation

/// Konfigurasi dari apkify.json (ditulis builder).
struct AppConfig: Decodable {
    struct Rule: Decodable { let pattern: String; let action: String }

    let name: String
    let startUrl: String
    let local: Bool
    let statusBar: String
    let fullscreen: Bool
    let pullToRefresh: Bool
    let externalLinksInBrowser: Bool
    let zoom: Bool
    let userAgentSuffix: String
    let customCss: String
    let customJs: String
    let jsApi: Bool
    let linkRules: [Rule]
    let appJson: String
    let errorHtml: String

    static let shared: AppConfig = {
        guard let url = Bundle.main.url(forResource: "apkify", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let cfg = try? JSONDecoder().decode(AppConfig.self, from: data) else {
            fatalError("apkify.json tidak valid")
        }
        return cfg
    }()
}
