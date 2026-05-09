import SwiftUI

struct ResourcesScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Environment(\.openURL) private var openURL
    @State private var q = ""
    @State private var stage = ""
    @State private var topic = ""
    @State private var county = ""
    @State private var industry = ""
    @State private var resources: [Resource] = []
    @State private var facets: PlatformFacets = .empty
    @State private var totalApprox = 0
    @State private var loading = false
    @State private var saved = Set<String>()

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 780
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if compact {
                        filters
                    } else {
                        HStack(alignment: .top, spacing: 14) {
                            filters
                                .frame(width: 300)
                            resourceGrid(compact: false)
                        }
                    }
                    if compact {
                        resourceGrid(compact: true)
                    }
                }
                .padding(compact ? 16 : 22)
            }
            .task {
                resources = store.resources
                facets = store.platform?.facets ?? .empty
                totalApprox = resources.count
                await load()
            }
            .onChange(of: q) { _, _ in debounceLoad() }
            .onChange(of: stage) { _, _ in debounceLoad() }
            .onChange(of: topic) { _, _ in debounceLoad() }
            .onChange(of: county) { _, _ in debounceLoad() }
            .onChange(of: industry) { _, _ in debounceLoad() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Manual mode", systemImage: "line.3.horizontal.decrease.circle")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.cyan)
            Text("Resource Explorer")
                .font(.system(size: 34, weight: .black))
                .foregroundStyle(palette.text)
            Text(loading ? "Updating results..." : "\(resources.count) shown from \(totalApprox) matching records")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(palette.muted)
        }
    }

    private var filters: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 14) {
                Label("Filters", systemImage: "slider.horizontal.3")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(palette.text)
                TextField("Search resources, counties, industries...", text: $q)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 12)
                    .frame(height: 46)
                    .foregroundStyle(palette.text)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(palette.panelStrong.opacity(0.78))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                    )
                ResourcePicker(title: "Stage", selection: $stage, options: facets.stages)
                ResourcePicker(title: "Topic", selection: $topic, options: facets.topics)
                ResourcePicker(title: "County", selection: $county, options: facets.counties)
                ResourcePicker(title: "Industry", selection: $industry, options: facets.industries)
                Button {
                    q = ""
                    stage = ""
                    topic = ""
                    county = ""
                    industry = ""
                } label: {
                    Label("Reset filters", systemImage: "arrow.counterclockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle())
            }
        }
    }

    private func resourceGrid(compact: Bool) -> some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: compact ? 1 : 2),
            spacing: 12
        ) {
            ForEach(resources) { resource in
                ResourceCard(resource: resource, saved: saved.contains(resource.id)) {
                    if saved.contains(resource.id) {
                        saved.remove(resource.id)
                    } else {
                        saved.insert(resource.id)
                    }
                }
            }
        }
    }

    private func debounceLoad() {
        Task {
            try? await Task.sleep(nanoseconds: 180_000_000)
            await load()
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let response = try await store.searchResources(
                q: q,
                stage: stage,
                topic: topic,
                county: county,
                industry: industry,
                limit: 80
            )
            resources = response.items
            facets = response.facets
            totalApprox = response.page.totalApprox
        } catch {
            store.status = store.userFacing(error)
            if resources.isEmpty {
                resources = store.resources
            }
        }
    }
}

struct ResourcePicker: View {
    @Environment(\.palette) private var palette
    var title: String
    @Binding var selection: String
    var options: [Facet]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(palette.muted)
            Picker(title, selection: $selection) {
                Text("Any").tag("")
                ForEach(options.prefix(60)) { option in
                    Text("\(option.label) (\(option.count))").tag(option.label)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
            .padding(.horizontal, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(palette.panelStrong.opacity(0.74))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
            )
        }
    }
}

struct ResourceCard: View {
    @Environment(\.palette) private var palette
    @Environment(\.openURL) private var openURL
    var resource: Resource
    var saved: Bool
    var toggleSaved: () -> Void

    var body: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(resource.stages.prefix(2).map(\.title).joined(separator: " / "))
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(palette.cyan)
                    Spacer()
                    if resource.freshness.status == "needs_review" {
                        Pill(title: "Needs review", tint: palette.orange)
                    }
                }
                Text(resource.title)
                    .font(.system(size: 19, weight: .black))
                    .foregroundStyle(palette.text)
                    .lineLimit(2)
                Text(resource.description)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(palette.text.opacity(0.78))
                    .lineSpacing(2)
                    .lineLimit(4)
                FlowTags(tags: Array(resource.topics.prefix(4)))
                HStack {
                    Button(action: toggleSaved) {
                        Label(saved ? "Saved" : "Save", systemImage: saved ? "bookmark.fill" : "bookmark")
                    }
                    .buttonStyle(NeonButtonStyle(tint: saved ? palette.green : palette.cyan))
                    Spacer()
                    Button {
                        if let url = URL(string: resource.link) {
                            openURL(url)
                        }
                    } label: {
                        Label("Open", systemImage: "arrow.up.right")
                    }
                    .buttonStyle(NeonButtonStyle(tint: palette.purple, filled: true))
                }
            }
        }
    }
}

struct FlowTags: View {
    @Environment(\.palette) private var palette
    var tags: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 94), spacing: 6)], alignment: .leading, spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(palette.muted)
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .frame(height: 28)
                    .background(
                        Capsule()
                            .fill(palette.panelStrong.opacity(0.8))
                            .overlay(Capsule().stroke(palette.line.opacity(0.75), lineWidth: 1))
                    )
            }
        }
    }
}
