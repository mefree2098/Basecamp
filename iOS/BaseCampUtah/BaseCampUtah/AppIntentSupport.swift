import AppIntents
import Foundation

struct OpenBasecampIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Basecamp"
    static var description = IntentDescription("Open the Basecamp iOS app.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        .result()
    }
}
