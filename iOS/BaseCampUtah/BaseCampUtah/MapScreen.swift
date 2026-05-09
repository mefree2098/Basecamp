import MapKit
import SwiftUI

struct MapScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var q = ""
    @State private var sector = ""
    @State private var stage = ""
    @State private var employees = ""
    @State private var location = ""
    @State private var hiring = "hiring"
    @State private var selectedSlug = ""
    @State private var filtersPresented = false
    @State private var heatmap = false
    @State private var mapStyleSatellite = false

    private var companies: [Company] {
        var items = store.companies
        if !store.settings.showExtraMapData {
            items = items.filter(\.isSeedRecord)
        }
        if !q.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let needle = q.lowercased()
            items = items.filter {
                [$0.name, $0.description, $0.location, $0.sector ?? "", $0.stage ?? ""]
                    .joined(separator: " ")
                    .lowercased()
                    .contains(needle)
            }
        }
        if !sector.isEmpty { items = items.filter { $0.sector == sector } }
        if !stage.isEmpty { items = items.filter { $0.stage == stage } }
        if !employees.isEmpty { items = items.filter { $0.employees == employees } }
        if !location.isEmpty { items = items.filter { $0.location == location } }
        if hiring == "hiring" { items = items.filter { $0.hiringStatus == .hiring } }
        if hiring == "not_hiring" { items = items.filter { $0.hiringStatus == .notHiring } }
        return items
    }

    private var selectedCompany: Company? {
        companies.first { $0.slug == selectedSlug } ?? companies.first
    }

    var body: some View {
        GeometryReader { proxy in
            let compact = horizontalSizeClass == .compact || proxy.size.width < 760
            let wide = proxy.size.width >= 1120
            Group {
                if compact {
                    compactLayout
                } else if wide {
                    wideLayout
                } else {
                    tabletLayout
                }
            }
            .padding(compact ? 0 : 16)
            .sheet(isPresented: $filtersPresented) {
                FiltersPanel(
                    q: $q,
                    sector: $sector,
                    stage: $stage,
                    employees: $employees,
                    location: $location,
                    hiring: $hiring
                )
                .environmentObject(store)
                .environment(\.palette, palette)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .onReceive(NotificationCenter.default.publisher(for: .basecampOpenFilters)) { _ in
                filtersPresented = true
            }
            .onChange(of: companies) { _, newValue in
                if selectedSlug.isEmpty || !newValue.contains(where: { $0.slug == selectedSlug }) {
                    selectedSlug = newValue.first?.slug ?? ""
                }
            }
        }
    }

    private var wideLayout: some View {
        HStack(spacing: 16) {
            FiltersPanel(
                q: $q,
                sector: $sector,
                stage: $stage,
                employees: $employees,
                location: $location,
                hiring: $hiring
            )
            .frame(width: 276)
            VStack(spacing: 14) {
                metricsGrid(columns: 2, compact: true)
                MapCanvas(
                    companies: companies,
                    selectedSlug: $selectedSlug,
                    heatmap: $heatmap,
                    mapStyleSatellite: $mapStyleSatellite
                )
            }
            if let selectedCompany {
                CompanyDetailPanel(company: selectedCompany, compact: false)
                    .frame(width: 396)
            }
        }
    }

    private var tabletLayout: some View {
        VStack(spacing: 12) {
            metricsGrid(columns: 4)
            HStack(spacing: 14) {
                FiltersPanel(
                    q: $q,
                    sector: $sector,
                    stage: $stage,
                    employees: $employees,
                    location: $location,
                    hiring: $hiring
                )
                .frame(width: 270)
                MapCanvas(
                    companies: companies,
                    selectedSlug: $selectedSlug,
                    heatmap: $heatmap,
                    mapStyleSatellite: $mapStyleSatellite
                )
            }
            if let selectedCompany {
                CompanyDetailPanel(company: selectedCompany, compact: false)
                    .frame(maxHeight: 300)
            }
        }
    }

    private var compactLayout: some View {
        GeometryReader { proxy in
            let short = proxy.size.height < 430
            ZStack(alignment: .bottom) {
                MapCanvas(
                    companies: companies,
                    selectedSlug: $selectedSlug,
                    heatmap: $heatmap,
                    mapStyleSatellite: $mapStyleSatellite
                )
                .ignoresSafeArea(edges: .bottom)
                VStack(spacing: short ? 8 : 10) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            MapFilterMenu(title: sector.isEmpty ? "All Sectors" : sector, selection: $sector, options: facetLabels(store.mapData?.facets.sectors ?? []), compact: true)
                            MapFilterMenu(title: employees.isEmpty ? "All Sizes" : employees, selection: $employees, options: facetLabels(store.mapData?.facets.employeeBands ?? []), compact: true)
                            MapFilterMenu(title: stage.isEmpty ? "All Stages" : stage, selection: $stage, options: facetLabels(store.mapData?.facets.companyStages ?? []), compact: true)
                            Button {
                                filtersPresented = true
                            } label: {
                                Label(short ? "Filters" : "More Filters", systemImage: "line.3.horizontal.decrease.circle")
                            }
                            .buttonStyle(CompactNeonButtonStyle())
                        }
                        .padding(.horizontal, 16)
                    }
                    if let selectedCompany {
                        CompanyDetailPanel(company: selectedCompany, compact: true)
                            .frame(maxHeight: short ? 210 : min(proxy.size.height * 0.68, 560))
                            .padding(.horizontal, 14)
                            .padding(.bottom, 12)
                    }
                }
            }
        }
    }

    private func metricsGrid(columns: Int, compact: Bool = false) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columns), spacing: 12) {
            MetricCard(
                title: "Total Startups",
                value: "\(companies.count)",
                detail: "\(store.companies.count) total records",
                symbol: "rocket",
                tint: palette.orange,
                compact: compact
            )
            MetricCard(
                title: "Hiring Now",
                value: "\(companies.filter { $0.hiringStatus == .hiring }.count)",
                detail: "Live company profiles",
                symbol: "person.badge.plus",
                tint: palette.green,
                compact: compact
            )
            MetricCard(
                title: "Sectors",
                value: "\(Set(companies.compactMap(\.sector)).count)",
                detail: "View all sectors",
                symbol: "point.3.connected.trianglepath.dotted",
                tint: palette.purple,
                compact: compact
            )
            MetricCard(
                title: "Verified Profiles",
                value: "\(companies.filter { $0.verificationStatus == .claimed || $0.verificationStatus == .seeded }.count)",
                detail: "Claimed and seeded",
                symbol: "checkmark.shield",
                tint: palette.blue,
                compact: compact
            )
        }
    }

    private func facetLabels(_ facets: [Facet]) -> [String] {
        facets.map(\.label)
    }
}

struct MapCanvas: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    var companies: [Company]
    @Binding var selectedSlug: String
    @Binding var heatmap: Bool
    @Binding var mapStyleSatellite: Bool
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 39.72, longitude: -111.55),
            span: MKCoordinateSpan(latitudeDelta: 5.4, longitudeDelta: 5.7)
        )
    )

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Map(position: $position) {
                ForEach(companies) { company in
                    Annotation(company.name, coordinate: coordinate(for: company)) {
                        CompanyMapMarker(company: company, selected: company.slug == selectedSlug, heatmap: heatmap)
                            .onTapGesture {
                                selectedSlug = company.slug
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    position = .region(
                                        MKCoordinateRegion(
                                            center: coordinate(for: company),
                                            span: MKCoordinateSpan(latitudeDelta: 0.55, longitudeDelta: 0.55)
                                        )
                                    )
                                }
                            }
                    }
                }
            }
            .mapStyle(mapStyleSatellite ? .hybrid(elevation: .realistic) : .standard(elevation: .realistic))
            .tint(palette.cyan)
            .overlay {
                if store.settings.theme == .tech {
                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.0, green: 0.03, blue: 0.10).opacity(0.42),
                                    Color(red: 0.0, green: 0.16, blue: 0.28).opacity(0.10)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .allowsHitTesting(false)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.line, lineWidth: 1)
            )
            .shadow(color: palette.shadow, radius: 18)

            VStack(spacing: 10) {
                IconCircleButton(symbol: "location", accessibilityLabel: "Center on Utah") {
                    position = .region(
                        MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 39.72, longitude: -111.55),
                            span: MKCoordinateSpan(latitudeDelta: 5.4, longitudeDelta: 5.7)
                        )
                    )
                }
                IconCircleButton(symbol: mapStyleSatellite ? "map" : "map.fill", accessibilityLabel: "Toggle map style") {
                    mapStyleSatellite.toggle()
                }
                Button {
                    heatmap.toggle()
                } label: {
                    Label("Heatmap", systemImage: "flame")
                        .font(.system(size: 13, weight: .heavy))
                        .frame(minHeight: 38)
                }
                .buttonStyle(NeonButtonStyle(tint: palette.orange))
            }
            .padding(14)

            if companies.isEmpty {
                EmptyStateView(
                    symbol: "map",
                    title: "No startups in view",
                    detail: "Change the filters or enable extra data to widen the map."
                )
                .background(palette.panel.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(24)
            }
        }
    }

    private func coordinate(for company: Company) -> CLLocationCoordinate2D {
        if let geocoded = store.mapData?.geocodedLocations[company.slug] {
            return geocoded.coordinate
        }
        return company.coordinate
    }
}

struct CompanyMapMarker: View {
    @Environment(\.palette) private var palette
    var company: Company
    var selected: Bool
    var heatmap: Bool

    private var tint: Color {
        switch company.sector?.lowercased() ?? "" {
        case let value where value.contains("manufacturing"):
            return palette.red
        case let value where value.contains("health"):
            return palette.green
        case let value where value.contains("finance"):
            return palette.orange
        case let value where value.contains("software") || value.contains("technology"):
            return palette.blue
        default:
            return palette.purple
        }
    }

    var body: some View {
        ZStack {
            if heatmap {
                Circle()
                    .fill(tint.opacity(0.18))
                    .frame(width: selected ? 92 : 60, height: selected ? 92 : 60)
                    .blur(radius: 6)
            }
            Circle()
                .fill(tint.opacity(0.92))
                .frame(width: selected ? 44 : 28, height: selected ? 44 : 28)
                .overlay(Circle().stroke(.white.opacity(0.85), lineWidth: selected ? 2 : 1))
                .shadow(color: tint, radius: selected ? 18 : 10)
            Text(company.hiringStatus == .hiring ? "H" : "•")
                .font(.system(size: selected ? 15 : 10, weight: .black))
                .foregroundStyle(.white)
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.78), value: selected)
    }
}

struct FiltersPanel: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Binding var q: String
    @Binding var sector: String
    @Binding var stage: String
    @Binding var employees: String
    @Binding var location: String
    @Binding var hiring: String

    var body: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Explore Utah Startups")
                        .font(.system(size: 18, weight: .black))
                        .foregroundStyle(palette.text)
                    Spacer()
                    Button("Reset all") {
                        q = ""
                        sector = ""
                        stage = ""
                        employees = ""
                        location = ""
                        hiring = ""
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(palette.cyan)
                }
                labeledTextField("Search", text: $q, symbol: "magnifyingglass")
                filterPicker("Sector", selection: $sector, options: store.mapData?.facets.sectors ?? [])
                filterPicker("Size", selection: $employees, options: store.mapData?.facets.employeeBands ?? [])
                filterPicker("Stage", selection: $stage, options: store.mapData?.facets.companyStages ?? [])
                PickerField(
                    title: "Hiring Status",
                    symbol: "briefcase",
                    selection: $hiring,
                    options: [
                        ("", "All"),
                        ("hiring", "Hiring Now"),
                        ("not_hiring", "Not hiring")
                    ]
                )
                filterPicker("Location", selection: $location, options: store.mapData?.facets.companyLocations ?? [])
                Toggle(isOn: Binding(
                    get: { store.settings.showExtraMapData },
                    set: { store.setShowExtraMapData($0) }
                )) {
                    Label("Extra data", systemImage: "square.stack.3d.up")
                        .font(.system(size: 14, weight: .bold))
                }
                .tint(palette.cyan)
                HStack {
                    Pill(title: hiring == "hiring" ? "Hiring Now" : "All hiring", symbol: "briefcase", tint: palette.green)
                    if !location.isEmpty {
                        Pill(title: location, symbol: "mappin", tint: palette.blue)
                    }
                }
                Spacer(minLength: 0)
                Button {
                    store.status = "Search saved on this device."
                } label: {
                    Label("Save Search", systemImage: "bookmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle())
                FounderGuideCallout()
            }
        }
    }

    private func labeledTextField(_ title: String, text: Binding<String>, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: symbol)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.text)
            TextField(title, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 12)
                .frame(height: 44)
                .foregroundStyle(palette.text)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(palette.panelStrong.opacity(0.72))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                )
        }
    }

    private func filterPicker(_ title: String, selection: Binding<String>, options: [Facet]) -> some View {
        PickerField(
            title: title,
            symbol: title == "Location" ? "mappin" : "line.3.horizontal.decrease",
            selection: selection,
            options: [("", "All \(title)s")] + options.prefix(60).map { ($0.label, "\($0.label) (\($0.count))") }
        )
    }
}

struct PickerField: View {
    @Environment(\.palette) private var palette
    var title: String
    var symbol: String
    @Binding var selection: String
    var options: [(String, String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: symbol)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(palette.text)
            Picker(title, selection: $selection) {
                ForEach(options, id: \.0) { value, label in
                    Text(label).tag(value)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(palette.panelStrong.opacity(0.72))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
            )
            .foregroundStyle(palette.text)
        }
    }
}

struct MapFilterMenu: View {
    @Environment(\.palette) private var palette
    var title: String
    @Binding var selection: String
    var options: [String]
    var compact = false

    var body: some View {
        Menu {
            Button("All") { selection = "" }
            ForEach(options.prefix(50), id: \.self) { option in
                Button(option) { selection = option }
            }
        } label: {
            HStack(spacing: 8) {
                Text(title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                Image(systemName: "chevron.down")
            }
            .frame(width: compact ? 92 : nil)
        }
        .buttonStyle(CompactNeonButtonStyle())
    }
}

struct CompactNeonButtonStyle: ButtonStyle {
    @Environment(\.palette) private var palette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .heavy))
            .foregroundStyle(palette.cyan)
            .padding(.horizontal, 8)
            .frame(minHeight: 42)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(palette.panelStrong.opacity(configuration.isPressed ? 0.68 : 0.86))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(palette.cyan.opacity(0.9), lineWidth: 1)
                    )
                    .shadow(color: palette.cyan.opacity(configuration.isPressed ? 0.10 : 0.22), radius: 10)
            )
    }
}


struct FounderGuideCallout: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            GuideSprite()
                .frame(width: 54, height: 66)
            VStack(alignment: .leading, spacing: 4) {
                Text("Hey founder!")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(palette.text)
                Text("Explore the ecosystem and discover opportunities.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(palette.muted)
                Button("Learn more") {
                    store.selectedSection = .wizard
                }
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(palette.cyan)
            }
        }
        .padding(12)
        .basecampCard()
    }
}

struct GuideSprite: View {
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(palette.orange.opacity(0.14))
            Image(systemName: "figure.hiking")
                .font(.system(size: 35, weight: .black))
                .foregroundStyle(palette.orange)
                .shadow(color: palette.cyan.opacity(0.45), radius: 8)
        }
    }
}

struct CompanyDetailPanel: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Environment(\.openURL) private var openURL
    var company: Company
    var compact: Bool

    var body: some View {
        GlassPanel(padding: compact ? 14 : 18) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: compact ? 12 : 16) {
                    Capsule()
                        .fill(palette.muted.opacity(0.4))
                        .frame(width: compact ? 56 : 0, height: compact ? 4 : 0)
                        .frame(maxWidth: .infinity)
                    HStack(alignment: .top, spacing: 14) {
                        CompanyIcon(company: company, size: compact ? 64 : 72)
                        VStack(alignment: .leading, spacing: 7) {
                            HStack(spacing: 8) {
                                Text(company.name)
                                    .font(.system(size: compact ? 25 : 28, weight: .black))
                                    .foregroundStyle(palette.text)
                                    .minimumScaleFactor(0.75)
                                    .lineLimit(2)
                                if company.verificationStatus != .pending {
                                    Pill(title: "Verified", symbol: "checkmark.circle", tint: palette.green)
                                }
                            }
                            Label("\(company.location)  •  \(company.employees ?? "Unknown size")", systemImage: "mappin.circle")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(palette.muted)
                            if let website = company.website, let url = URL(string: website) {
                                Button {
                                    openURL(url)
                                } label: {
                                    Label(website.replacingOccurrences(of: "https://", with: ""), systemImage: "globe")
                                        .font(.system(size: 14, weight: .bold))
                                }
                                .foregroundStyle(palette.cyan)
                            }
                        }
                        Spacer()
                    }

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: compact ? 2 : 3), spacing: 8) {
                        fact("Sector", company.sector ?? "Unknown", "square.grid.2x2")
                        fact("Size", company.employees ?? "Unknown", "person.2")
                        fact("Stage", company.stage ?? "Unknown", "rocket")
                        fact("Founded", company.foundedYear.map(String.init) ?? "Unknown", "calendar")
                        fact("Hiring", company.hiringStatus.label, "briefcase")
                        fact("Jobs", "\(company.jobPostings?.count ?? 0) open roles", "list.bullet.rectangle")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("About")
                            .font(.system(size: 17, weight: .black))
                            .foregroundStyle(palette.text)
                        Text(company.description)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(palette.text.opacity(0.82))
                            .lineSpacing(3)
                            .lineLimit(compact ? 5 : nil)
                    }
                    .padding(12)
                    .basecampCard()

                    if let jobs = company.jobPostings, !jobs.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Open Positions")
                                    .font(.system(size: 15, weight: .black))
                                Spacer()
                                if let jobsUrl = company.jobsUrl, let url = URL(string: jobsUrl) {
                                    Button("View all jobs") { openURL(url) }
                                        .font(.system(size: 12, weight: .heavy))
                                        .foregroundStyle(palette.cyan)
                                }
                            }
                            ForEach(jobs.prefix(compact ? 2 : 4)) { job in
                                Button {
                                    if let urlString = job.url, let url = URL(string: urlString) {
                                        openURL(url)
                                    }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(job.title)
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundStyle(palette.text)
                                            Text([job.location, job.type].compactMap { $0 }.joined(separator: "  •  "))
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundStyle(palette.muted)
                                        }
                                        Spacer()
                                        Pill(title: "New", tint: palette.green)
                                        Image(systemName: "chevron.right")
                                            .foregroundStyle(palette.muted)
                                    }
                                }
                                .buttonStyle(.plain)
                                .padding(.vertical, 6)
                            }
                        }
                        .padding(12)
                        .basecampCard()
                    }

                    if !company.gallery.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Photo Gallery")
                                    .font(.system(size: 15, weight: .black))
                                Spacer()
                                Text("View all (\(company.gallery.count))")
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(palette.cyan)
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(company.gallery.prefix(8), id: \.self) { item in
                                        AsyncImage(url: store.resolvedURL(item)) { phase in
                                            switch phase {
                                            case .success(let image):
                                                image.resizable().scaledToFill()
                                            default:
                                                Rectangle()
                                                    .fill(palette.panelStrong)
                                                    .overlay(Image(systemName: "photo").foregroundStyle(palette.muted))
                                            }
                                        }
                                        .frame(width: compact ? 104 : 120, height: compact ? 72 : 82)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                                    }
                                }
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        Button {
                            store.companyDraftPrefillSlug = company.slug
                            store.selectedSection = .companies
                        } label: {
                            Label("Claim Profile", systemImage: "shield")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeonButtonStyle(tint: palette.red))
                        Button {
                            if let url = store.resolvedURL("/companies/\(company.slug)") {
                                openURL(url)
                            }
                        } label: {
                            Label("View Full Profile", systemImage: "arrow.up.right")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeonButtonStyle(tint: palette.purple, filled: true))
                    }
                }
            }
        }
    }

    private func fact(_ title: String, _ value: String, _ symbol: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
                .foregroundStyle(palette.purple)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(palette.muted)
                Text(value)
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(palette.text)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .basecampCard()
    }
}

struct CompanyIcon: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    var company: Company
    var size: CGFloat

    var body: some View {
        ZStack {
            if let iconURL = store.resolvedURL(store.mapData?.companyIcons[company.slug]?.url) {
                AsyncImage(url: iconURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    default:
                        GemLogo()
                    }
                }
            } else {
                GemLogo()
            }
        }
        .frame(width: size, height: size)
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(palette.red.opacity(0.12))
                .shadow(color: palette.red.opacity(0.4), radius: 10)
        )
    }
}

struct GemLogo: View {
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            PolygonShape(sides: 7)
                .fill(LinearGradient(colors: [palette.red, palette.orange.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing))
            PolygonShape(sides: 7)
                .stroke(.white.opacity(0.58), lineWidth: 1)
                .padding(7)
        }
    }
}

struct PolygonShape: Shape {
    var sides: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard sides > 2 else { return path }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        for index in 0..<sides {
            let angle = (Double(index) / Double(sides)) * 2 * Double.pi - Double.pi / 2
            let point = CGPoint(
                x: center.x + CGFloat(cos(angle)) * radius,
                y: center.y + CGFloat(sin(angle)) * radius
            )
            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()
        return path
    }
}
