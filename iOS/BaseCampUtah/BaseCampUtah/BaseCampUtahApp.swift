//
//  BaseCampUtahApp.swift
//  BaseCampUtah
//
//  Created by Matt Freestone on 5/9/26.
//

import SwiftUI

@main
struct BaseCampUtahApp: App {
    @StateObject private var store = BasecampStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
