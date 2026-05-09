import SwiftUI
import UniformTypeIdentifiers

struct AdminScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Environment(\.openURL) private var openURL
    @State private var csvKind = "resources"
    @State private var csv = ""
    @State private var publicLimit = 1000
    @State private var fileImporterOpen = false
    @State private var browserApiKey = ""
    @State private var geocodingApiKey = ""
    @State private var mapId = ""
    @State private var techMapId = ""

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 900
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    stats
                    if compact {
                        integrationsPanel
                        publicSourcePanel
                        csvPanel
                        draftPanel
                        aiPanel
                    } else {
                        HStack(alignment: .top, spacing: 16) {
                            VStack(spacing: 16) {
                                integrationsPanel
                                csvPanel
                                aiPanel
                            }
                            VStack(spacing: 16) {
                                publicSourcePanel
                                draftPanel
                            }
                            .frame(width: 430)
                        }
                    }
                }
                .padding(compact ? 16 : 22)
            }
            .task {
                await store.refreshAdmin()
                hydrateIntegrationFields()
            }
            .onChange(of: store.adminIntegrations?.updatedAt ?? "") { _, _ in
                hydrateIntegrationFields()
            }
            .fileImporter(isPresented: $fileImporterOpen, allowedContentTypes: [.commaSeparatedText, .plainText]) { result in
                if case .success(let url) = result,
                   let text = try? String(contentsOf: url, encoding: .utf8) {
                    csv = text
                    store.status = "Loaded \(url.lastPathComponent)."
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Operator console", systemImage: "shield.lefthalf.filled")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.cyan)
            Text("Update without redeploying")
                .font(.system(size: 32, weight: .black))
                .foregroundStyle(palette.text)
            Text(store.status)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(palette.muted)
        }
    }

    private var stats: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
            MetricCard(title: "Resources Seeded", value: "\(store.adminSummary?.resourceCount ?? store.resources.count)", detail: "Startup State corpus", symbol: "database", tint: palette.cyan)
            MetricCard(title: "Company Profiles", value: "\(store.adminSummary?.companyCount ?? store.companies.count)", detail: "Map records", symbol: "building.2", tint: palette.blue)
            MetricCard(title: "Freshness Flags", value: "\(store.adminSummary?.needsReview ?? 0)", detail: "Need review", symbol: "checkmark.shield", tint: palette.orange)
            MetricCard(title: "Draft Queue", value: "\(store.adminSummary?.drafts.count ?? 0)", detail: "Claims and updates", symbol: "tray.full", tint: palette.purple)
        }
    }

    private var integrationsPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Text("Map Integrations")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                if let integrations = store.adminIntegrations {
                    Text("Browser key \(integrations.googleMaps.hasBrowserApiKey ? "configured" : "not set")  •  Server geocoding \(integrations.googleMaps.hasServerGeocodingKey ? "configured" : "not set")")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(palette.muted)
                }
                field("Browser API key", text: $browserApiKey, secure: true)
                field("Server geocoding key", text: $geocodingApiKey, secure: true)
                field("Map ID", text: $mapId)
                field("Tech map ID", text: $techMapId)
                HStack {
                    Button {
                        Task {
                            await store.updateIntegrations(
                                GoogleMapsPatch(
                                    browserApiKey: browserApiKey.isEmpty ? nil : browserApiKey,
                                    geocodingApiKey: geocodingApiKey.isEmpty ? nil : geocodingApiKey,
                                    mapId: mapId,
                                    techMapId: techMapId,
                                    clearBrowserApiKey: false,
                                    clearGeocodingApiKey: false
                                )
                            )
                        }
                    } label: {
                        Label("Save settings", systemImage: "checkmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                    Menu {
                        Button("Clear browser key", role: .destructive) {
                            Task {
                                await store.updateIntegrations(
                                    GoogleMapsPatch(browserApiKey: nil, geocodingApiKey: nil, mapId: nil, techMapId: nil, clearBrowserApiKey: true, clearGeocodingApiKey: false)
                                )
                            }
                        }
                        Button("Clear server key", role: .destructive) {
                            Task {
                                await store.updateIntegrations(
                                    GoogleMapsPatch(browserApiKey: nil, geocodingApiKey: nil, mapId: nil, techMapId: nil, clearBrowserApiKey: false, clearGeocodingApiKey: true)
                                )
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .frame(width: 44, height: 44)
                    }
                    .foregroundStyle(palette.text)
                }
            }
        }
    }

    private var publicSourcePanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Label("Public business source", systemImage: "map")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                if let preview = store.publicImportPreview {
                    Text(preview.source.name)
                        .font(.system(size: 17, weight: .black))
                        .foregroundStyle(palette.text)
                    Text("\(preview.availableCount.formatted()) eligible business records available")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(palette.muted)
                    FlowTags(tags: Array(preview.categories.prefix(6)))
                    Picker("Import limit", selection: $publicLimit) {
                        Text("500").tag(500)
                        Text("1,000").tag(1000)
                        Text("2,500").tag(2500)
                        Text("5,000").tag(5000)
                    }
                    .pickerStyle(.segmented)
                    HStack {
                        Button {
                            Task { await store.importPublicCompanies(limit: publicLimit) }
                        } label: {
                            Label("Import records", systemImage: "tray.and.arrow.down")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeonButtonStyle(tint: palette.green, filled: true))
                        Button {
                            if let url = URL(string: preview.source.url) {
                                openURL(url)
                            }
                        } label: {
                            Image(systemName: "arrow.up.right")
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(NeonButtonStyle())
                    }
                    if let imported = preview.importedCount {
                        Text("Last import: \(imported.formatted()) added, \(preview.skippedDuplicateCount ?? 0) duplicates skipped.")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(palette.muted)
                    }
                } else {
                    EmptyStateView(symbol: "arrow.clockwise", title: "Loading source", detail: "Basecamp is checking the public import preview.")
                }
            }
        }
    }

    private var csvPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Text("CSV Import")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                Picker("Dataset", selection: $csvKind) {
                    Text("Resources").tag("resources")
                    Text("Companies").tag("companies")
                }
                .pickerStyle(.segmented)
                Button {
                    fileImporterOpen = true
                } label: {
                    Label("Choose CSV file", systemImage: "doc.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle())
                TextField("Paste CSV", text: $csv, axis: .vertical)
                    .lineLimit(6...12)
                    .padding(12)
                    .foregroundStyle(palette.text)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(palette.panelStrong.opacity(0.76))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                    )
                Button {
                    Task { await store.importAdminCSV(kind: csvKind, csv: csv) }
                } label: {
                    Label("Import dataset", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle(tint: palette.purple, filled: true))
                .disabled(csv.trimmingCharacters(in: .whitespacesAndNewlines).count < 5)
            }
        }
    }

    private var draftPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Draft Review")
                        .font(.system(size: 20, weight: .black))
                        .foregroundStyle(palette.text)
                    Spacer()
                    Button {
                        Task { await store.refreshAdmin() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .foregroundStyle(palette.cyan)
                }
                let drafts = store.adminSummary?.drafts ?? []
                if drafts.isEmpty {
                    EmptyStateView(symbol: "tray", title: "No drafts waiting", detail: "Company claims and updates will appear here.")
                } else {
                    ForEach(drafts) { draft in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(draft.payload?.name ?? draft.id)
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundStyle(palette.text)
                                    Text("\(draft.status)  •  \(draft.verificationStatus)")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(palette.muted)
                                }
                                Spacer()
                                Pill(title: draft.domainMatch?.ok == true ? "Domain OK" : "Needs contact", tint: draft.domainMatch?.ok == true ? palette.green : palette.orange)
                            }
                            if let reason = draft.domainMatch?.reason {
                                Text(reason)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(palette.muted)
                            }
                            HStack {
                                Button {
                                    Task { await store.reviewDraft(id: draft.id, action: "approve") }
                                } label: {
                                    Label("Approve", systemImage: "checkmark")
                                }
                                .buttonStyle(NeonButtonStyle(tint: palette.green))
                                Button {
                                    Task { await store.reviewDraft(id: draft.id, action: "reject") }
                                } label: {
                                    Label("Reject", systemImage: "xmark")
                                }
                                .buttonStyle(NeonButtonStyle(tint: palette.red))
                            }
                        }
                        .padding(12)
                        .basecampCard()
                    }
                }
            }
        }
    }

    private var aiPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Text("AI Controls")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                Picker("Provider", selection: Binding(
                    get: { store.settings.aiSettings.provider },
                    set: {
                        var next = store.settings.aiSettings
                        next.provider = $0
                        next.model = defaultModel(for: $0)
                        store.setAiSettings(next)
                    }
                )) {
                    ForEach(AiProvider.allCases) { provider in
                        Text(provider.title).tag(provider)
                    }
                }
                .pickerStyle(.menu)
                field("Model", text: Binding(
                    get: { store.settings.aiSettings.model },
                    set: {
                        var next = store.settings.aiSettings
                        next.model = $0
                        store.setAiSettings(next)
                    }
                ))
                Picker("Thinking", selection: Binding(
                    get: { store.settings.aiSettings.thinkingLevel },
                    set: {
                        var next = store.settings.aiSettings
                        next.thinkingLevel = $0
                        store.setAiSettings(next)
                    }
                )) {
                    ForEach(ThinkingLevel.allCases) { level in
                        Text(level.title).tag(level)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }

    private func field(_ title: String, text: Binding<String>, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(palette.muted)
            if secure {
                SecureField(title, text: text)
                    .fieldChrome()
            } else {
                TextField(title, text: text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .fieldChrome()
            }
        }
    }

    private func hydrateIntegrationFields() {
        guard let integrations = store.adminIntegrations else { return }
        mapId = integrations.googleMaps.mapId
        techMapId = integrations.googleMaps.techMapId
    }

    private func defaultModel(for provider: AiProvider) -> String {
        switch provider {
        case .mock: "basecamp-local-guide"
        case .openai: "gpt-5.1"
        case .codexPath: "gpt-5.5"
        case .anthropic: "claude-sonnet-4.5"
        case .gemini: "gemini-2.5-pro"
        }
    }
}
