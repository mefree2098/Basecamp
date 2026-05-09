import SwiftUI

struct SettingsScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @State private var serverURL = ""
    @State private var status = ""

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 760
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    GlassPanel {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Backend")
                                .font(.system(size: 20, weight: .black))
                                .foregroundStyle(palette.text)
                            TextField("Basecamp server URL", text: $serverURL)
                                .keyboardType(.URL)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .fieldChrome()
                            HStack {
                                Button {
                                    Task { await saveServerURL() }
                                } label: {
                                    Label("Save and sync", systemImage: "arrow.triangle.2.circlepath")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                                Button {
                                    serverURL = AppSettings.default.serverURL
                                } label: {
                                    Label("Production", systemImage: "globe")
                                }
                                .buttonStyle(NeonButtonStyle())
                            }
                            if let health = store.health {
                                HStack {
                                    Pill(title: health.storageWritable == false ? "Storage issue" : "Healthy", symbol: "heart.text.square", tint: health.storageWritable == false ? palette.orange : palette.green)
                                    Text(health.service ?? "basecamp")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(palette.muted)
                                }
                            }
                        }
                    }

                    GlassPanel {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Appearance")
                                .font(.system(size: 20, weight: .black))
                                .foregroundStyle(palette.text)
                            Picker("Theme", selection: Binding(
                                get: { store.settings.theme },
                                set: { store.setTheme($0) }
                            )) {
                                ForEach(BasecampTheme.allCases) { theme in
                                    Text(theme.title).tag(theme)
                                }
                            }
                            .pickerStyle(.segmented)
                            Toggle("Show extra map data", isOn: Binding(
                                get: { store.settings.showExtraMapData },
                                set: { store.setShowExtraMapData($0) }
                            ))
                            .tint(palette.cyan)
                        }
                    }

                    GlassPanel {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Sync")
                                .font(.system(size: 20, weight: .black))
                                .foregroundStyle(palette.text)
                            if let last = store.lastSyncedAt {
                                Text("Last synced \(last.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(palette.muted)
                            }
                            Text(store.status)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(palette.muted)
                            HStack {
                                Button {
                                    Task { await store.refreshCoreData(silent: false) }
                                } label: {
                                    Label("Refresh now", systemImage: "arrow.clockwise")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(NeonButtonStyle())
                                Button(role: .destructive) {
                                    store.clearCache()
                                } label: {
                                    Label("Clear cache", systemImage: "trash")
                                }
                                .buttonStyle(NeonButtonStyle(tint: palette.red))
                            }
                        }
                    }
                }
                .padding(compact ? 16 : 22)
            }
            .onAppear {
                serverURL = store.settings.serverURL
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Settings", systemImage: "gearshape")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.cyan)
            Text("Basecamp iOS")
                .font(.system(size: 32, weight: .black))
                .foregroundStyle(palette.text)
            Text(status.isEmpty ? "Native client settings, sync, and cache controls." : status)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(palette.muted)
        }
    }

    private func saveServerURL() async {
        await store.updateServerURL(serverURL)
        status = store.status
    }
}
