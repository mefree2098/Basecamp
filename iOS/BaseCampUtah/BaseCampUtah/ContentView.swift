import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: BasecampStore
    @State private var menuOpen = false

    private var palette: BasecampPalette {
        BasecampPalette.palette(for: store.settings.theme)
    }

    var body: some View {
        ZStack {
            AppBackground(theme: store.settings.theme)
            GeometryReader { proxy in
                let headerMode = HeaderMode(width: proxy.size.width)
                VStack(spacing: 0) {
                    switch headerMode {
                    case .compact:
                        CompactHeader(menuOpen: $menuOpen)
                    case .tablet:
                        TabletHeader(menuOpen: $menuOpen)
                    case .desktop:
                        DesktopHeader()
                    }
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .sheet(isPresented: $menuOpen) {
                    NavigationMenu()
                        .environmentObject(store)
                        .environment(\.palette, palette)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
        }
        .environment(\.palette, palette)
        .preferredColorScheme(store.settings.theme == .tech ? .dark : .light)
        .task {
            await store.bootstrap()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch store.selectedSection {
        case .map:
            MapScreen()
        case .resources:
            ResourcesScreen()
        case .wizard:
            FounderNavigatorScreen()
        case .companies:
            CompanySubmissionScreen()
        case .admin:
            AdminScreen()
        case .profile:
            ProfileScreen()
        case .settings:
            SettingsScreen()
        }
    }
}

private enum HeaderMode {
    case compact
    case tablet
    case desktop

    init(width: CGFloat) {
        if width < 700 {
            self = .compact
        } else if width < 1500 {
            self = .tablet
        } else {
            self = .desktop
        }
    }
}

struct DesktopHeader: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 18) {
            BrandMark()
                .frame(minWidth: 225, alignment: .leading)
            Label {
                Text("Search startups, founders, sectors, or locations...")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                Spacer()
                Text("⌘K")
                    .font(.system(size: 12, weight: .heavy))
                    .padding(.horizontal, 8)
                    .frame(height: 26)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(palette.panelStrong)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(palette.line, lineWidth: 1))
                    )
            } icon: {
                Image(systemName: "magnifyingglass")
            }
            .foregroundStyle(palette.muted)
            .padding(.horizontal, 16)
            .frame(maxWidth: 560, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(palette.panelStrong.opacity(0.78))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
            )

            HStack(spacing: 6) {
                ForEach(AppSection.allCases.filter { $0 != .settings }) { section in
                    HeaderNavButton(section: section)
                }
            }
            .frame(maxWidth: .infinity)

            Menu {
                Picker("Theme", selection: Binding(
                    get: { store.settings.theme },
                    set: { store.setTheme($0) }
                )) {
                    ForEach(BasecampTheme.allCases) { theme in
                        Text(theme.title).tag(theme)
                    }
                }
                Button {
                    store.selectedSection = .settings
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
            } label: {
                Image(systemName: "paintpalette")
                    .frame(width: 42, height: 42)
            }
            .foregroundStyle(palette.text)

            NotificationButton()
            AccountButton()
        }
        .padding(.horizontal, 24)
        .frame(minHeight: 78)
        .background(
            Rectangle()
                .fill(palette.elevated.opacity(store.settings.theme == .tech ? 0.88 : 0.96))
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(palette.line)
                        .frame(height: 1)
                }
        )
    }
}

struct TabletHeader: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Binding var menuOpen: Bool

    var body: some View {
        HStack(spacing: 12) {
            IconCircleButton(symbol: "line.3.horizontal", accessibilityLabel: "Open menu") {
                menuOpen = true
            }
            BrandMark(compact: true)
                .layoutPriority(2)
            searchCapsule
                .frame(minWidth: 190, maxWidth: 420)
                .layoutPriority(1)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(AppSection.allCases.filter { $0 != .settings }) { section in
                        HeaderIconNavButton(section: section)
                    }
                }
                .padding(.horizontal, 1)
            }
            .frame(maxWidth: 350)
            Menu {
                Picker("Theme", selection: Binding(
                    get: { store.settings.theme },
                    set: { store.setTheme($0) }
                )) {
                    ForEach(BasecampTheme.allCases) { theme in
                        Text(theme.title).tag(theme)
                    }
                }
                Button {
                    store.selectedSection = .settings
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
            } label: {
                Image(systemName: "paintpalette")
                    .frame(width: 42, height: 42)
            }
            .foregroundStyle(palette.text)
            NotificationButton()
            AccountButton()
        }
        .padding(.horizontal, 18)
        .frame(minHeight: 72)
        .background(
            Rectangle()
                .fill(palette.elevated.opacity(store.settings.theme == .tech ? 0.9 : 0.97))
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(palette.line)
                        .frame(height: 1)
                }
        )
    }

    private var searchCapsule: some View {
        Label {
            Text("Search startups, founders, sectors...")
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        } icon: {
            Image(systemName: "magnifyingglass")
        }
        .foregroundStyle(palette.muted)
        .padding(.horizontal, 14)
        .frame(minHeight: 44, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(palette.panelStrong.opacity(0.78))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
        )
    }
}

struct CompactHeader: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @Binding var menuOpen: Bool

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                IconCircleButton(symbol: "line.3.horizontal", accessibilityLabel: "Open menu") {
                    menuOpen = true
                }
                BrandMark(compact: true, showUtah: false)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)
                NotificationButton()
                AccountButton()
            }
            HStack(spacing: 10) {
                Label("Search startups, founders, sectors...", systemImage: "magnifyingglass")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(palette.muted)
                    .lineLimit(1)
                    .padding(.horizontal, 15)
                    .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(palette.panelStrong.opacity(0.78))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.line, lineWidth: 1))
                    )
                IconCircleButton(symbol: "slider.horizontal.3", accessibilityLabel: "Open filters") {
                    if store.selectedSection != .map {
                        store.selectedSection = .map
                    }
                    NotificationCenter.default.post(name: .basecampOpenFilters, object: nil)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(
            Rectangle()
                .fill(palette.elevated.opacity(0.92))
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(palette.line)
                        .frame(height: 1)
                }
        )
    }
}

struct HeaderNavButton: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    var section: AppSection

    var active: Bool { store.selectedSection == section }

    var body: some View {
        Button {
            store.selectedSection = section
        } label: {
            Label(section.title, systemImage: section.symbol)
                .font(.system(size: 13, weight: .heavy))
                .lineLimit(1)
                .padding(.horizontal, 10)
                .frame(minHeight: 40)
                .foregroundStyle(active ? palette.text : palette.muted)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(active ? palette.blue.opacity(0.18) : .clear)
                )
                .overlay(alignment: .bottom) {
                    if active {
                        Capsule()
                            .fill(palette.cyan)
                            .frame(width: 52, height: 3)
                            .offset(y: 8)
                            .shadow(color: palette.cyan, radius: 8)
                    }
                }
        }
        .buttonStyle(.plain)
    }
}

struct HeaderIconNavButton: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    var section: AppSection

    private var active: Bool { store.selectedSection == section }

    var body: some View {
        Button {
            store.selectedSection = section
        } label: {
            Image(systemName: section.symbol)
                .font(.system(size: 17, weight: .bold))
                .frame(width: 42, height: 42)
                .foregroundStyle(active ? palette.text : palette.muted)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(active ? palette.blue.opacity(0.20) : .clear)
                )
                .overlay(alignment: .bottom) {
                    if active {
                        Capsule()
                            .fill(palette.cyan)
                            .frame(width: 30, height: 3)
                            .offset(y: 7)
                            .shadow(color: palette.cyan, radius: 8)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(section.title)
    }
}

struct NotificationButton: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette

    var body: some View {
        Button {
            store.selectedSection = .profile
            Task { await store.markNotificationsRead() }
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell")
                    .font(.system(size: 20, weight: .bold))
                    .frame(width: 42, height: 42)
                if store.auth.unreadCount > 0 {
                    Text("\(store.auth.unreadCount)")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(.white)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Circle().fill(palette.red))
                        .offset(x: 4, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.text)
        .accessibilityLabel("Notifications")
    }
}

struct AccountButton: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette

    var body: some View {
        Button {
            store.selectedSection = .profile
        } label: {
            HStack(spacing: 6) {
                AvatarView(user: store.auth.user, size: 42)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(palette.muted)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Profile")
    }
}

struct AvatarView: View {
    @Environment(\.palette) private var palette
    var user: FounderUser?
    var size: CGFloat

    var body: some View {
        ZStack {
            if let avatarUrl = user?.avatarUrl, let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(palette.text.opacity(0.72), lineWidth: 2))
    }

    private var initials: some View {
        Text(initialsForName(user?.name ?? "Founder"))
            .font(.system(size: size * 0.34, weight: .black))
            .foregroundStyle(palette.background)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                LinearGradient(colors: [Color(red: 1.0, green: 0.82, blue: 0.58), .white], startPoint: .topLeading, endPoint: .bottomTrailing)
            )
    }
}

struct NavigationMenu: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground(theme: store.settings.theme)
                List {
                    Section {
                        ForEach(AppSection.allCases) { section in
                            Button {
                                store.selectedSection = section
                                dismiss()
                            } label: {
                                Label(section.title, systemImage: section.symbol)
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(store.selectedSection == section ? palette.cyan : palette.text)
                            }
                            .listRowBackground(Color.clear)
                        }
                    }
                    Section("Theme") {
                        Picker("Theme", selection: Binding(
                            get: { store.settings.theme },
                            set: { store.setTheme($0) }
                        )) {
                            ForEach(BasecampTheme.allCases) { theme in
                                Text(theme.title).tag(theme)
                            }
                        }
                        .pickerStyle(.segmented)
                        .listRowBackground(Color.clear)
                    }
                    Section("Sync") {
                        Text(store.status)
                            .foregroundStyle(palette.muted)
                            .listRowBackground(Color.clear)
                        Button {
                            Task { await store.refreshCoreData(silent: false) }
                        } label: {
                            Label("Refresh now", systemImage: "arrow.clockwise")
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Basecamp")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

extension Notification.Name {
    static let basecampOpenFilters = Notification.Name("basecampOpenFilters")
}

func initialsForName(_ name: String) -> String {
    let parts = name.split(separator: " ")
    if let first = parts.first, let last = parts.dropFirst().last {
        return "\(first.prefix(1))\(last.prefix(1))".uppercased()
    }
    return String((parts.first ?? "U").prefix(2)).uppercased()
}
