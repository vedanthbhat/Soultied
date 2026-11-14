import SwiftUI
import UIKit
import CoreLocation
import SoultiedCore

/*
 * How far apart you are, and what time it is for your person (meta/where, shared with the website). Their time
 * shows as soon as they've opened Soultied; the distance once you've both chosen to share roughly where you are
 * (rounded to about 10 km before it's kept: the town, never the street).
 */

/// asks once for roughly where you are (the reduced accuracy is plenty)
@MainActor final class Locator: NSObject, ObservableObject, CLLocationManagerDelegate {
    enum Said { case denied, unavailable }
    @Published var busy = false
    @Published var said: Said?
    private let manager = CLLocationManager()
    private var then: ((CLLocation) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyReduced
    }

    var allowed: Bool { [.authorizedWhenInUse, .authorizedAlways].contains(manager.authorizationStatus) }

    func find(_ then: @escaping (CLLocation) -> Void) {
        said = nil
        self.then = then
        switch manager.authorizationStatus {
        case .notDetermined:
            busy = true
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            said = .denied
        default:
            busy = true
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            guard self.busy else { return }
            switch status {
            case .authorizedWhenInUse, .authorizedAlways: self.manager.requestLocation()
            case .denied, .restricted:
                self.busy = false
                self.said = .denied
            default: break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last else { return }
        let lat = l.coordinate.latitude, lon = l.coordinate.longitude
        Task { @MainActor in
            self.busy = false
            self.then?(CLLocation(latitude: lat, longitude: lon))
            self.then = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let denied = (error as? CLError)?.code == .denied
        Task { @MainActor in
            self.busy = false
            self.said = denied ? .denied : .unavailable
        }
    }
}

struct ApartCard: View {
    let place: PlaceModel
    @StateObject private var locator = Locator()

    var body: some View {
        TimelineView(.periodic(from: .now, by: 20)) { ctx in
            content(at: ctx.date)
        }
        .pxCard()
        .onAppear {
            // once you're sharing, where you are follows you (quietly, twice a day at most)
            if let m = place.whereMine, m.sharing, !place.isDemo, locator.allowed, Values.nowMs() - m.at > 12 * 3600e3 {
                locator.find { place.shareWhere(lat: $0.coordinate.latitude, lon: $0.coordinate.longitude) }
            }
        }
    }

    private func content(at now: Date) -> some View {
        let name = place.theirName
        let km = place.apartKm
        let clock = TheirClock(zone: place.whereTheirs?.tz ?? "", mine: place.myZone, at: now)
        let sharing = place.whereMine?.sharing ?? false
        let theyShare = place.whereTheirs?.sharing ?? false
        let miles = countsInMiles(region: Locale.current.region?.identifier)
        let title = km.map { apartLabel($0, miles: miles) } ?? clock.map { "It’s \($0.text) for \(name)" } ?? "How far apart are you?"
        var bits: [String] = []
        if let c = clock {
            if km != nil { bits.append("It’s \(c.text) for \(name)") }
            if let a = c.ahead { bits.append(a) }
            if asleepHour(c.hour) { bits.append("probably asleep") }
        }
        let line = bits.joined(separator: " · ")
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 14) {
                GlyphView(glyph: UsGlyphs.pin, scale: 4)
                VStack(alignment: .leading, spacing: 2) {
                    Text(km != nil ? "How far apart" : clock != nil ? "Their time" : "How far apart").font(.pxTiny).foregroundStyle(Color.muted)
                    Text(title).font(.pxHeading).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    if !line.isEmpty {
                        Text(line).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            }
            if !sharing {
                Text("Share roughly where you are (the town, never the street) and you’ll both see how far apart you are.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                Button(locator.busy ? "Finding you…" : "Share where I am") {
                    locator.find { place.shareWhere(lat: $0.coordinate.latitude, lon: $0.coordinate.longitude) }
                    Haptics.select()
                }
                .buttonStyle(.px(.sage, wide: true))
                .disabled(locator.busy)
            } else if !theyShare {
                Text("You’re sharing roughly where you are. Once \(name) does too, you’ll both see how far apart you are.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            if let said = locator.said {
                HStack(spacing: 10) {
                    Text(said == .denied ? "Location’s off for Soultied. You can turn it on in Settings." : "Couldn’t find where you are just now. Try again in a moment.")
                        .font(.pxSmall).foregroundStyle(Color.terracottaD).fixedSize(horizontal: false, vertical: true)
                    if said == .denied, let url = URL(string: UIApplication.openSettingsURLString) {
                        Spacer(minLength: 0)
                        Link("Settings", destination: url).font(.pxBodyBold).foregroundStyle(Color.terracottaD)
                    }
                }
            }
            if sharing {
                Button("Stop sharing where I am") { place.stopSharingWhere() }
                    .font(.pxSmall).foregroundStyle(Color.terracottaD)
            }
        }
        .accessibilityElement(children: .contain)
    }
}
