import Foundation

struct CacheStore {
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private var baseDirectory: URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appendingPathComponent("BaseCampUtah", isDirectory: true)
    }

    func loadSettings() -> AppSettings {
        (try? load(AppSettings.self, filename: "settings.json")) ?? .default
    }

    func saveSettings(_ settings: AppSettings) {
        try? save(settings, filename: "settings.json")
    }

    func loadBootstrap() -> BootstrapCache? {
        try? load(BootstrapCache.self, filename: "bootstrap.json")
    }

    func saveBootstrap(_ cache: BootstrapCache) {
        try? save(cache, filename: "bootstrap.json")
    }

    func clearBootstrap() {
        try? FileManager.default.removeItem(at: baseDirectory.appendingPathComponent("bootstrap.json"))
    }

    private func load<T: Decodable>(_ type: T.Type, filename: String) throws -> T {
        let url = baseDirectory.appendingPathComponent(filename)
        let data = try Data(contentsOf: url)
        return try decoder.decode(type, from: data)
    }

    private func save<T: Encodable>(_ value: T, filename: String) throws {
        try FileManager.default.createDirectory(at: baseDirectory, withIntermediateDirectories: true)
        let url = baseDirectory.appendingPathComponent(filename)
        let data = try encoder.encode(value)
        try data.write(to: url, options: [.atomic])
    }
}
