import SwiftUI

struct ProfileScreen: View {
    @EnvironmentObject private var store: BasecampStore
    @Environment(\.palette) private var palette
    @State private var name = ""
    @State private var email = ""
    @State private var status = ""

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 820
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let user = store.auth.user {
                        signedInView(user: user, compact: compact)
                    } else {
                        signedOutView
                    }
                }
                .padding(compact ? 16 : 22)
            }
            .task {
                await store.refreshCoreData(silent: true)
            }
        }
    }

    private func signedInView(user: FounderUser, compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            GlassPanel {
                HStack(spacing: 16) {
                    AvatarView(user: user, size: 74)
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Profile", systemImage: "person.crop.circle")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(palette.cyan)
                        Text(user.name)
                            .font(.system(size: 32, weight: .black))
                            .foregroundStyle(palette.text)
                        Text(user.email)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(palette.muted)
                    }
                    Spacer()
                    Button {
                        Task { await store.signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    .buttonStyle(NeonButtonStyle(tint: palette.red))
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: compact ? 1 : 2), spacing: 14) {
                accountPanel(user: user)
                notificationsPanel
            }

            preferencesPanel
        }
    }

    private var signedOutView: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 14) {
                Label("Profile", systemImage: "person.crop.circle")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(palette.cyan)
                Text("Create your Startup State profile")
                    .font(.system(size: 32, weight: .black))
                    .foregroundStyle(palette.text)
                Text("Save founder conversations, company drafts, application updates, and resource progress.")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(palette.muted)
                TextField("Name", text: $name)
                    .textContentType(.name)
                    .fieldChrome()
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .fieldChrome()
                HStack {
                    Button {
                        Task { await signIn(.site) }
                    } label: {
                        Label("Register", systemImage: "person.badge.plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeonButtonStyle(tint: palette.cyan, filled: true))
                    Menu {
                        Button("Microsoft") { Task { await signIn(.microsoft) } }
                        Button("Google") { Task { await signIn(.google) } }
                        Button("Meta") { Task { await signIn(.meta) } }
                    } label: {
                        Label("Providers", systemImage: "person.2.badge.gearshape")
                    }
                    .buttonStyle(NeonButtonStyle())
                }
                if !status.isEmpty {
                    Text(status)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(palette.muted)
                }
            }
        }
        .padding(.top, 12)
    }

    private func accountPanel(user: FounderUser) -> some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Text("Account")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                fact("Provider", user.provider.title, "person.badge.key")
                fact("Roles", user.roles.map(\.label).joined(separator: ", "), "shield")
                fact("Connected", user.authProviders.map(\.title).joined(separator: ", "), "link")
                Button {
                    store.selectedSection = .wizard
                } label: {
                    Label("Founder workbench", systemImage: "checklist")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeonButtonStyle())
            }
        }
    }

    private var notificationsPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Status updates")
                        .font(.system(size: 20, weight: .black))
                        .foregroundStyle(palette.text)
                    Spacer()
                    Button {
                        Task { await store.markNotificationsRead() }
                    } label: {
                        Label("Mark read", systemImage: "checkmark.circle")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(palette.cyan)
                }
                if store.auth.notifications.isEmpty {
                    EmptyStateView(symbol: "bell", title: "No updates yet", detail: "Application, permit, grant, and profile updates will appear here.")
                } else {
                    ForEach(store.auth.notifications) { notification in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Circle()
                                    .fill(notification.readAt == nil ? palette.red : palette.green)
                                    .frame(width: 9, height: 9)
                                Text(notification.title)
                                    .font(.system(size: 14, weight: .heavy))
                                    .foregroundStyle(palette.text)
                            }
                            Text(notification.message)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(palette.muted)
                        }
                        .padding(10)
                        .basecampCard()
                    }
                }
            }
        }
    }

    private var preferencesPanel: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: 12) {
                Label("Preferences", systemImage: "gearshape")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(palette.text)
                Toggle("Application and form status", isOn: .constant(true))
                    .tint(palette.cyan)
                Toggle("Funding updates", isOn: .constant(true))
                    .tint(palette.cyan)
                Toggle("Founder Navigator follow-ups", isOn: .constant(true))
                    .tint(palette.cyan)
                Text("Preference controls are mirrored from the web profile surface and remain local until the hosted database adds notification channel storage.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(palette.muted)
            }
        }
    }

    private func fact(_ title: String, _ value: String, _ symbol: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(palette.purple)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(palette.muted)
                Text(value.isEmpty ? "None" : value)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(palette.text)
            }
            Spacer()
        }
        .padding(10)
        .basecampCard()
    }

    private func signIn(_ provider: AuthProviderID) async {
        do {
            try await store.signIn(provider: provider, name: name.isEmpty ? nil : name, email: email.isEmpty ? nil : email)
            status = "Profile ready."
        } catch {
            status = store.userFacing(error)
        }
    }
}
